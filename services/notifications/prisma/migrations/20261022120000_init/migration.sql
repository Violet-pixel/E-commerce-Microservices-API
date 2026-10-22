CREATE TYPE "NotificationKind" AS ENUM ('WELCOME', 'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'PAYMENT_DECLINED');

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "order_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_event_id_key" ON "notifications"("event_id");

CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
