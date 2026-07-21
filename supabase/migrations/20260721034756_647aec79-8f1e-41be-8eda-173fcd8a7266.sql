-- CTT CRM training reseed (v2)
BEGIN;
DELETE FROM training_quiz_questions;
DELETE FROM training_quizzes;
DELETE FROM training_lessons;
DELETE FROM training_modules_v2;
DELETE FROM training_phases;
COMMIT;