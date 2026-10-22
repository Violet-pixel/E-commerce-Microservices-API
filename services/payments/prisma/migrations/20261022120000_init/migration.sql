CREATE TYPE "PaymentStatus" AS ENUM ('APPROVED', 'DECLINED', 'REFUNDED');

CREATE TYPE "PaymentMethod" AS ENUM ('card', 'pix', 'boleto');

CREATE TYPE "Currency" AS ENUM ('BRL', 'USD', 'EUR');

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BRL',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reason" VARCHAR(200),
    "provider_ref" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "handled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "envelope" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");
