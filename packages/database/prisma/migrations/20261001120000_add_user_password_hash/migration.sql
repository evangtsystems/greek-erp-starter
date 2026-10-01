ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "role" "OrganizationRole" NOT NULL DEFAULT 'VIEWER';
