CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED');

CREATE TABLE "stock_items" (
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("product_id"),
    CONSTRAINT "stock_items_available_check" CHECK ("available" >= 0),
    CONSTRAINT "stock_items_reserved_check" CHECK ("reserved" >= 0)
);

CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservations_quantity_check" CHECK ("quantity" > 0)
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

CREATE UNIQUE INDEX "reservations_order_id_product_id_key" ON "reservations"("order_id", "product_id");

CREATE INDEX "reservations_status_created_at_idx" ON "reservations"("status", "created_at");

CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "stock_items"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
