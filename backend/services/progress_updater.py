from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from database.models import (
    Student, GrammarMistake, VocabularyWord, ConversationHistory,
    ProgressRecord, Lesson
)


class ProgressUpdater:
    """
    Recalculates all scores with REALISTIC progression.
    All queries are scoped to a specific student_id.
    """

    MESSAGES_FOR_FULL_SPEAKING = 500
    WORDS_FOR_FULL_VOCABULARY = 200
    STREAK_FOR_FULL_CONFIDENCE = 60
    EXERCISES_FOR_FULL_GRAMMAR = 300

    def update_all(self, db: Session, student_id: int):
        """Run all score updates for a specific student."""
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return

        student.grammar_score = self._calculate_grammar_score(db, student_id)
        student.vocabulary_score = self._calculate_vocabulary_score(db, student_id)
        student.speaking_score = self._calculate_speaking_score(db, student_id)
        student.listening_score = min(student.speaking_score * 0.3, 100)
        student.confidence_score = self._calculate_confidence_score(db, student, student_id)
        student.pronunciation_score = min(student.speaking_score * 0.2, 100)

        student.overall_score = round(
            student.grammar_score * 0.25 +
            student.vocabulary_score * 0.25 +
            student.speaking_score * 0.20 +
            student.confidence_score * 0.10 +
            student.pronunciation_score * 0.10 +
            student.listening_score * 0.10
        , 1)

        student.weaknesses = self._get_weaknesses(db, student_id)

        new_level = self._determine_level(student.overall_score)
        if self._level_rank(new_level) > self._level_rank(student.current_level):
            student.current_level = new_level

        self._record_progress_snapshot(db, student, student_id)
        db.commit()

    def save_new_words(self, db: Session, student_id: int, new_words: list):
        """Save vocabulary words from Claude's response."""
        for word_data in new_words:
            word_text = word_data.get("word", "").lower().strip()
            if not word_text or len(word_text) < 2:
                continue

            existing = db.query(VocabularyWord).filter(
                VocabularyWord.student_id == student_id,
                VocabularyWord.word == word_text,
            ).first()

            if not existing:
                new_word = VocabularyWord(
                    student_id=student_id,
                    word=word_text,
                    meaning=word_data.get("meaning", ""),
                    example_sentence=word_data.get("example", ""),
                    difficulty_level=self._guess_word_level(word_text),
                    is_known=False,
                    mastery_count=0,
                )
                db.add(new_word)

    def _calculate_grammar_score(self, db: Session, student_id: int) -> float:
        total_user_messages = db.query(ConversationHistory).filter(
            ConversationHistory.student_id == student_id,
            ConversationHistory.role == "user",
        ).count()

        if total_user_messages == 0:
            return 0.0

        if total_user_messages < 10:
            return round(total_user_messages * 0.3, 1)

        all_user_msgs = db.query(ConversationHistory).filter(
            ConversationHistory.student_id == student_id,
            ConversationHistory.role == "user",
        ).all()

        error_messages = sum(1 for msg in all_user_msgs if msg.corrections and len(msg.corrections) > 0)
        clean_messages = total_user_messages - error_messages
        accuracy_rate = clean_messages / total_user_messages

        volume_factor = min(1.0, total_user_messages / 100)

        unresolved = db.query(GrammarMistake).filter(
            GrammarMistake.student_id == student_id,
            GrammarMistake.is_resolved == False,
        ).count()
        penalty = min(30, unresolved * 2)

        raw_score = (accuracy_rate * volume_factor * 70) - penalty
        return round(min(100, max(0, raw_score)), 1)

    def _calculate_vocabulary_score(self, db: Session, student_id: int) -> float:
        total_words = db.query(VocabularyWord).filter(
            VocabularyWord.student_id == student_id
        ).count()
        if total_words == 0:
            return 0.0

        mastered_words = db.query(VocabularyWord).filter(
            VocabularyWord.student_id == student_id,
            VocabularyWord.mastery_count >= 3,
        ).count()

        known_words = db.query(VocabularyWord).filter(
            VocabularyWord.student_id == student_id,
            VocabularyWord.is_known == True,
        ).count()

        mastery_score = min(100, (mastered_words / self.WORDS_FOR_FULL_VOCABULARY) * 100)
        known_bonus = min(20, (known_words / 100) * 20)
        encounter_bonus = min(10, (total_words / 200) * 10)

        score = mastery_score * 0.7 + known_bonus * 0.2 + encounter_bonus * 0.1
        return round(min(100, max(0, score)), 1)

    def _calculate_speaking_score(self, db: Session, student_id: int) -> float:
        user_messages = db.query(ConversationHistory).filter(
            ConversationHistory.student_id == student_id,
            ConversationHistory.role == "user",
        ).all()

        total_msgs = len(user_messages)
        if total_msgs == 0:
            return 0.0

        volume_score = min(100, max(0, ((total_msgs - 10) / self.MESSAGES_FOR_FULL_SPEAKING) * 100))

        if total_msgs >= 50:
            total_words = sum(len(msg.message.split()) for msg in user_messages)
            avg_length = total_words / total_msgs
            quality_score = min(100, (avg_length / 15) * 100)
        else:
            quality_score = 0

        if total_msgs >= 30:
            recent = user_messages[-30:]
            errors_in_recent = sum(1 for m in recent if m.corrections and len(m.corrections) > 0)
            recent_accuracy = ((len(recent) - errors_in_recent) / len(recent)) * 100
        else:
            recent_accuracy = 0

        score = (volume_score * 0.50) + (quality_score * 0.25) + (recent_accuracy * 0.25)
        return round(min(100, max(0, score)), 1)

    def _calculate_confidence_score(self, db: Session, student: Student, student_id: int) -> float:
        streak_score = min(100, (student.streak_days / self.STREAK_FOR_FULL_CONFIDENCE) * 100)
        xp_score = min(100, (student.xp_total / 5000) * 100)

        all_user_msgs = db.query(ConversationHistory).filter(
            ConversationHistory.student_id == student_id,
            ConversationHistory.role == "user",
        ).order_by(ConversationHistory.created_at).all()

        if len(all_user_msgs) >= 20:
            midpoint = len(all_user_msgs) // 2
            older = all_user_msgs[:midpoint]
            recent = all_user_msgs[midpoint:]

            old_errors = sum(1 for m in older if m.corrections and len(m.corrections) > 0)
            new_errors = sum(1 for m in recent if m.corrections and len(m.corrections) > 0)

            old_rate = old_errors / max(len(older), 1)
            new_rate = new_errors / max(len(recent), 1)

            if old_rate > new_rate:
                improvement_score = min(100, ((old_rate - new_rate) / max(old_rate, 0.01)) * 100)
            else:
                improvement_score = 20
        else:
            improvement_score = 10

        score = (streak_score * 0.35) + (xp_score * 0.30) + (improvement_score * 0.35)
        return round(min(100, max(0, score)), 1)

    def _get_weaknesses(self, db: Session, student_id: int) -> list:
        unresolved = db.query(GrammarMistake).filter(
            GrammarMistake.student_id == student_id,
            GrammarMistake.is_resolved == False,
        ).all()

        type_counts = {}
        for mistake in unresolved:
            t = mistake.error_type or "unknown"
            type_counts[t] = type_counts.get(t, 0) + 1

        sorted_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
        return [t[0] for t in sorted_types[:5]]

    def _determine_level(self, overall_score: float) -> str:
        if overall_score >= 92:
            return "C2"
        elif overall_score >= 78:
            return "C1"
        elif overall_score >= 60:
            return "B2"
        elif overall_score >= 45:
            return "B1"
        elif overall_score >= 25:
            return "A2"
        return "A1"

    def _level_rank(self, level: str) -> int:
        ranks = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
        return ranks.get(level, 1)

    def _record_progress_snapshot(self, db: Session, student: Student, student_id: int):
        today = date.today()

        existing = db.query(ProgressRecord).filter(
            ProgressRecord.student_id == student_id,
            func.date(ProgressRecord.recorded_at) == today,
        ).first()

        if existing:
            existing.grammar_score = student.grammar_score
            existing.vocabulary_score = student.vocabulary_score
            existing.speaking_score = student.speaking_score
            existing.listening_score = student.listening_score
            existing.pronunciation_score = student.pronunciation_score
            existing.confidence_score = student.confidence_score
            existing.overall_score = student.overall_score
            existing.xp_earned = student.xp_today
        else:
            words_learned = db.query(VocabularyWord).filter(
                VocabularyWord.student_id == student_id, VocabularyWord.is_known == True
            ).count()
            lessons_done = db.query(Lesson).filter(
                Lesson.student_id == student_id, Lesson.is_completed == True
            ).count()
            mistakes_fixed = db.query(GrammarMistake).filter(
                GrammarMistake.student_id == student_id, GrammarMistake.is_resolved == True
            ).count()

            record = ProgressRecord(
                student_id=student_id,
                grammar_score=student.grammar_score,
                vocabulary_score=student.vocabulary_score,
                speaking_score=student.speaking_score,
                listening_score=student.listening_score,
                pronunciation_score=student.pronunciation_score,
                confidence_score=student.confidence_score,
                overall_score=student.overall_score,
                xp_earned=student.xp_today,
                lessons_completed=lessons_done,
                words_learned=words_learned,
                mistakes_fixed=mistakes_fixed,
            )
            db.add(record)

    def _guess_word_level(self, word: str) -> str:
        if len(word) <= 4:
            return "A1"
        elif len(word) <= 6:
            return "A2"
        elif len(word) <= 8:
            return "B1"
        elif len(word) <= 10:
            return "B2"
        return "C1"
