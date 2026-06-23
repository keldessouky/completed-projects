import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Itinerary } from '@prisma/client';
import { LandmarkResponse } from '../landmarks/landmark.entity';
import { LandmarksService } from '../landmarks/landmarks.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItinerariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landmarks: LandmarksService,
  ) {}

  /** Lists only the caller's itineraries. */
  findAllForUser(userId: number): Promise<Itinerary[]> {
    return this.prisma.itinerary.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });
  }

  create(userId: number, name: string): Promise<Itinerary> {
    return this.prisma.itinerary.create({
      data: { name, userId },
    });
  }

  /**
   * Deletes an itinerary the caller owns. The owning rows in
   * itinerary_landmarks cascade away via the schema relation.
   */
  async remove(userId: number, itineraryId: number): Promise<void> {
    await this.assertOwnership(userId, itineraryId);
    await this.prisma.itinerary.delete({ where: { id: itineraryId } });
  }

  /** Lists the landmarks in one of the caller's itineraries. */
  async getLandmarks(userId: number, itineraryId: number): Promise<LandmarkResponse[]> {
    await this.assertOwnership(userId, itineraryId);
    const rows = await this.prisma.itineraryLandmark.findMany({
      where: { itineraryId },
      include: { landmark: { include: { images: true } } },
      orderBy: { landmarkId: 'asc' },
    });
    return rows.map((row) => ({
      id: row.landmark.id,
      name: row.landmark.name,
      summary: row.landmark.summary,
      description: row.landmark.description,
      img: row.landmark.img,
      mapLink: row.landmark.mapLink,
      addressId: row.landmark.addressId,
      images: row.landmark.images.map((image) => image.imageName),
    }));
  }

  /** Adds a landmark to the caller's itinerary (idempotent). */
  async addLandmark(userId: number, itineraryId: number, landmarkId: number): Promise<void> {
    await this.assertOwnership(userId, itineraryId);

    const landmark = await this.prisma.landmark.findUnique({ where: { id: landmarkId } });
    if (!landmark) {
      throw new NotFoundException(`Landmark ${landmarkId} not found`);
    }

    await this.prisma.itineraryLandmark.upsert({
      where: { itineraryId_landmarkId: { itineraryId, landmarkId } },
      create: { itineraryId, landmarkId },
      update: {},
    });
  }

  /** Removes a landmark from the caller's itinerary. */
  async removeLandmark(userId: number, itineraryId: number, landmarkId: number): Promise<void> {
    await this.assertOwnership(userId, itineraryId);
    await this.prisma.itineraryLandmark.deleteMany({
      where: { itineraryId, landmarkId },
    });
  }

  /**
   * Loads the itinerary and verifies the caller owns it. Returns 404 when it
   * doesn't exist and 403 when it belongs to someone else — so a user can't
   * read or mutate another user's itinerary (the original IDOR).
   */
  private async assertOwnership(userId: number, itineraryId: number): Promise<Itinerary> {
    const itinerary = await this.prisma.itinerary.findUnique({ where: { id: itineraryId } });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary ${itineraryId} not found`);
    }
    if (itinerary.userId !== userId) {
      throw new ForbiddenException('You do not have access to this itinerary');
    }
    return itinerary;
  }
}
