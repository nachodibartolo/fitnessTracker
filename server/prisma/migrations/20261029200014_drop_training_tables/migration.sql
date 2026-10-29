/*
  Warnings:

  - You are about to drop the `Exercise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExerciseSet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Program` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramBlock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramDay` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramExercise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramExerciseAlternative` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionExercise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrainingSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseSet" DROP CONSTRAINT "ExerciseSet_sessionExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT "Program_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramBlock" DROP CONSTRAINT "ProgramBlock_programId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramDay" DROP CONSTRAINT "ProgramDay_blockId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramExercise" DROP CONSTRAINT "ProgramExercise_dayId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramExercise" DROP CONSTRAINT "ProgramExercise_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramExerciseAlternative" DROP CONSTRAINT "ProgramExerciseAlternative_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramExerciseAlternative" DROP CONSTRAINT "ProgramExerciseAlternative_programExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "SessionExercise" DROP CONSTRAINT "SessionExercise_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "SessionExercise" DROP CONSTRAINT "SessionExercise_programExerciseId_fkey";

-- DropForeignKey
ALTER TABLE "SessionExercise" DROP CONSTRAINT "SessionExercise_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingSession" DROP CONSTRAINT "TrainingSession_programDayId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingSession" DROP CONSTRAINT "TrainingSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingSession" DROP CONSTRAINT "TrainingSession_workoutId_fkey";

-- DropTable
DROP TABLE "Exercise";

-- DropTable
DROP TABLE "ExerciseSet";

-- DropTable
DROP TABLE "Program";

-- DropTable
DROP TABLE "ProgramBlock";

-- DropTable
DROP TABLE "ProgramDay";

-- DropTable
DROP TABLE "ProgramExercise";

-- DropTable
DROP TABLE "ProgramExerciseAlternative";

-- DropTable
DROP TABLE "SessionExercise";

-- DropTable
DROP TABLE "TrainingSession";

-- DropEnum
DROP TYPE "Equipment";

-- DropEnum
DROP TYPE "MuscleGroup";
