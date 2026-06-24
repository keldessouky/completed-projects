-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(200) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'ROLE_USER',

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "address" (
    "address_id" SERIAL NOT NULL,
    "street" VARCHAR(64),
    "building_num" INTEGER,
    "postal_code" INTEGER,
    "city" VARCHAR(32),
    "country" VARCHAR(32),

    CONSTRAINT "address_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "landmark" (
    "landmark_id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "summary" VARCHAR(128) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "img" VARCHAR(64) NOT NULL,
    "map_link" VARCHAR(4000),
    "address_id" INTEGER NOT NULL,

    CONSTRAINT "landmark_pkey" PRIMARY KEY ("landmark_id")
);

-- CreateTable
CREATE TABLE "images" (
    "image_name" VARCHAR(64) NOT NULL,
    "landmark_id" INTEGER NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("image_name")
);

-- CreateTable
CREATE TABLE "itinerary" (
    "itinerary_id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "itinerary_pkey" PRIMARY KEY ("itinerary_id")
);

-- CreateTable
CREATE TABLE "itinerary_landmarks" (
    "itinerary_id" INTEGER NOT NULL,
    "landmark_id" INTEGER NOT NULL,

    CONSTRAINT "itinerary_landmarks_pkey" PRIMARY KEY ("itinerary_id","landmark_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "landmark" ADD CONSTRAINT "landmark_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_landmark_id_fkey" FOREIGN KEY ("landmark_id") REFERENCES "landmark"("landmark_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary" ADD CONSTRAINT "itinerary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_landmarks" ADD CONSTRAINT "itinerary_landmarks_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itinerary"("itinerary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_landmarks" ADD CONSTRAINT "itinerary_landmarks_landmark_id_fkey" FOREIGN KEY ("landmark_id") REFERENCES "landmark"("landmark_id") ON DELETE RESTRICT ON UPDATE CASCADE;
