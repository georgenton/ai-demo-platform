-- NOTA: `prisma migrate dev` propuso DROP INDEX "Chunk_embedding_hnsw_idx"
-- al generar esta migración porque ese índice no está declarado en
-- schema.prisma (Prisma 6 no modela índices HNSW de pgvector). Lo
-- removimos a mano: el índice se creó en la migración previa
-- (20260524134805_add_chunk_embedding_column) y debe sobrevivir.
-- Si volvés a regenerar migraciones después de tocar el schema,
-- repetí esta edición.

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('enrolled', 'withdrawn', 'completed');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('parcial-1', 'parcial-2', 'final');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'enrolled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Enrollment_term_idx" ON "Enrollment"("term");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_term_idx" ON "Enrollment"("courseId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_courseId_term_key" ON "Enrollment"("studentId", "courseId", "term");

-- CreateIndex
CREATE INDEX "Grade_examType_idx" ON "Grade"("examType");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_enrollmentId_examType_key" ON "Grade"("enrollmentId", "examType");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
