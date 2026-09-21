-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');

-- CreateEnum
CREATE TYPE "HealthImportChannel" AS ENUM ('APPLE_HEALTH_XML', 'HEALTHKIT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('TRADITIONAL_STRENGTH_TRAINING', 'FUNCTIONAL_STRENGTH_TRAINING', 'RUNNING', 'WALKING', 'CYCLING', 'STAIR_CLIMBING', 'SWIMMING', 'HIIT', 'OTHER');

-- CreateEnum
CREATE TYPE "HealthMetric" AS ENUM ('BODY_MASS', 'BODY_FAT_PERCENTAGE', 'LEAN_BODY_MASS', 'BODY_MASS_INDEX', 'HEIGHT', 'RESTING_HEART_RATE', 'HEART_RATE_VARIABILITY_SDNN', 'VO2_MAX');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'ABDUCTORS', 'ABS', 'LOWER_BACK', 'FULL_BODY', 'OTHER');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'EZ_BAR', 'CABLE', 'MACHINE', 'BODYWEIGHT', 'KETTLEBELL', 'OTHER');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "MealSource" AS ENUM ('MANUAL', 'AI_IMAGE', 'AI_TEXT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG',
    "heightCm" DOUBLE PRECISION,
    "birthDate" DATE,
    "dailyKcalTarget" INTEGER,
    "dailyProteinTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthImport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "HealthImportChannel" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rangeFrom" DATE,
    "rangeTo" DATE,
    "daysUpserted" INTEGER NOT NULL DEFAULT 0,
    "workoutsUpserted" INTEGER NOT NULL DEFAULT 0,
    "samplesInserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "HealthImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyHealthSummary" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "importId" UUID,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "flightsClimbed" INTEGER,
    "activeEnergyKcal" DOUBLE PRECISION,
    "basalEnergyKcal" DOUBLE PRECISION,
    "activeEnergyGoalKcal" DOUBLE PRECISION,
    "exerciseMin" INTEGER,
    "standHours" INTEGER,
    "restingHeartRate" INTEGER,
    "avgHeartRate" DOUBLE PRECISION,
    "minHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "hrvSdnnMs" DOUBLE PRECISION,
    "respiratoryRate" DOUBLE PRECISION,
    "oxygenSaturation" DOUBLE PRECISION,
    "sleepStartedAt" TIMESTAMP(3),
    "sleepEndedAt" TIMESTAMP(3),
    "sleepInBedMin" INTEGER,
    "sleepAsleepMin" INTEGER,
    "sleepCoreMin" INTEGER,
    "sleepDeepMin" INTEGER,
    "sleepRemMin" INTEGER,
    "sleepAwakeMin" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "leanBodyMassKg" DOUBLE PRECISION,
    "workoutCount" INTEGER NOT NULL DEFAULT 0,
    "workoutMin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyHealthSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "importId" UUID,
    "type" "WorkoutType" NOT NULL,
    "activityTypeRaw" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" DOUBLE PRECISION NOT NULL,
    "activeEnergyKcal" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "avgHeartRate" DOUBLE PRECISION,
    "maxHeartRate" INTEGER,
    "isIndoor" BOOLEAN,
    "sourceName" TEXT NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSample" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "importId" UUID,
    "metric" "HealthMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "sourceName" TEXT NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "HealthSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" "MuscleGroup",
    "equipment" "Equipment",
    "isBodyweight" BOOLEAN NOT NULL DEFAULT false,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlock" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weekCount" INTEGER NOT NULL DEFAULT 4,
    "startDate" DATE,
    "endDate" DATE,

    CONSTRAINT "ProgramBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgramDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExercise" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "variant" TEXT,
    "supersetGroup" TEXT,
    "supersetOrder" INTEGER,
    "warmupSetsMin" INTEGER,
    "warmupSetsMax" INTEGER,
    "targetSets" INTEGER,
    "targetRepsMin" INTEGER,
    "targetRepsMax" INTEGER,
    "isAmrap" BOOLEAN NOT NULL DEFAULT false,
    "isDropset" BOOLEAN NOT NULL DEFAULT false,
    "rpeMin" DOUBLE PRECISION,
    "rpeMax" DOUBLE PRECISION,
    "targetRaw" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProgramExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExerciseAlternative" (
    "programExerciseId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ProgramExerciseAlternative_pkey" PRIMARY KEY ("programExerciseId","exerciseId")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programDayId" UUID,
    "weekNumber" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "dateIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "durationMin" INTEGER,
    "notes" TEXT,
    "workoutId" UUID,
    "importKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "programExerciseId" UUID,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "rawLog" TEXT,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" UUID NOT NULL,
    "sessionExerciseId" UUID NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "dropIndex" INTEGER NOT NULL DEFAULT 0,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "weightKg" DOUBLE PRECISION,
    "reps" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "mealType" "MealType",
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "calories" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "source" "MealSource" NOT NULL DEFAULT 'MANUAL',
    "aiModel" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiRaw" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "calories" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHealthSummary_userId_date_key" ON "DailyHealthSummary"("userId", "date");

-- CreateIndex
CREATE INDEX "Workout_userId_startedAt_idx" ON "Workout"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_sourceName_startedAt_key" ON "Workout"("userId", "sourceName", "startedAt");

-- CreateIndex
CREATE INDEX "HealthSample_userId_metric_measuredAt_idx" ON "HealthSample"("userId", "metric", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSample_userId_metric_sourceName_measuredAt_key" ON "HealthSample"("userId", "metric", "sourceName", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_userId_name_key" ON "Program"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramBlock_programId_order_key" ON "ProgramBlock"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDay_blockId_order_key" ON "ProgramDay"("blockId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramExercise_dayId_order_key" ON "ProgramExercise"("dayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramExerciseAlternative_programExerciseId_rank_key" ON "ProgramExerciseAlternative"("programExerciseId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_workoutId_key" ON "TrainingSession"("workoutId");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_performedAt_idx" ON "TrainingSession"("userId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_userId_importKey_key" ON "TrainingSession"("userId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExercise_sessionId_order_key" ON "SessionExercise"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSet_sessionExerciseId_setNumber_dropIndex_key" ON "ExerciseSet"("sessionExerciseId", "setNumber", "dropIndex");

-- CreateIndex
CREATE INDEX "Meal_userId_eatenAt_idx" ON "Meal"("userId", "eatenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MealItem_mealId_order_key" ON "MealItem"("mealId", "order");

-- AddForeignKey
ALTER TABLE "HealthImport" ADD CONSTRAINT "HealthImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyHealthSummary" ADD CONSTRAINT "DailyHealthSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyHealthSummary" ADD CONSTRAINT "DailyHealthSummary_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HealthImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HealthImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSample" ADD CONSTRAINT "HealthSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSample" ADD CONSTRAINT "HealthSample_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HealthImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramDay" ADD CONSTRAINT "ProgramDay_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExercise" ADD CONSTRAINT "ProgramExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExercise" ADD CONSTRAINT "ProgramExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseAlternative" ADD CONSTRAINT "ProgramExerciseAlternative_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "ProgramExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseAlternative" ADD CONSTRAINT "ProgramExerciseAlternative_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "ProgramDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "ProgramExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
