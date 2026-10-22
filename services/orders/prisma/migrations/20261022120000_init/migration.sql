CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TYPE "PaymentMethod" AS ENUM ('card', 'pix', 'boleto');

CREATE TYPE "Currency" AS ENUM ('BRL', 'USD', 'EUR');

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total_cents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BRL',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_token" VARCHAR(64),
    "shipping_address" JSONB NOT NULL,
    "cancel_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_total_cents_check" CHECK ("total_cents" >= 0)
);

CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "order_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_history_pkey" PRIMARY KEY ("id")
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

CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

CREATE INDEX "order_history_order_id_created_at_idx" ON "order_history"("order_id", "created_at");

CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
