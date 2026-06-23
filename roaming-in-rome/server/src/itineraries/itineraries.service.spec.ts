import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';
import { LandmarksService } from '../landmarks/landmarks.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * These tests pin down the core access-control rule: a user must not be able to
 * read or mutate another user's itinerary.
 */
describe('ItinerariesService ownership', () => {
  let service: ItinerariesService;
  let prisma: {
    itinerary: { findUnique: jest.Mock; delete: jest.Mock };
    itineraryLandmark: { findMany: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    landmark: { findUnique: jest.Mock };
  };

  const OWNER_ID = 1;
  const OTHER_USER_ID = 2;
  const ITINERARY_ID = 10;

  beforeEach(() => {
    prisma = {
      itinerary: { findUnique: jest.fn(), delete: jest.fn() },
      itineraryLandmark: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      landmark: { findUnique: jest.fn() },
    };
    service = new ItinerariesService(
      prisma as unknown as PrismaService,
      {} as unknown as LandmarksService,
    );
  });

  it('throws 404 when the itinerary does not exist', async () => {
    prisma.itinerary.findUnique.mockResolvedValue(null);
    await expect(service.remove(OWNER_ID, ITINERARY_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.itinerary.delete).not.toHaveBeenCalled();
  });

  it('throws 403 when the itinerary belongs to another user (delete)', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Theirs',
      userId: OTHER_USER_ID,
    });
    await expect(service.remove(OWNER_ID, ITINERARY_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.itinerary.delete).not.toHaveBeenCalled();
  });

  it('throws 403 when reading another user\'s itinerary landmarks', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Theirs',
      userId: OTHER_USER_ID,
    });
    await expect(service.getLandmarks(OWNER_ID, ITINERARY_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.itineraryLandmark.findMany).not.toHaveBeenCalled();
  });

  it('throws 403 when adding a landmark to another user\'s itinerary', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Theirs',
      userId: OTHER_USER_ID,
    });
    await expect(service.addLandmark(OWNER_ID, ITINERARY_ID, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.itineraryLandmark.upsert).not.toHaveBeenCalled();
  });

  it('allows the owner to delete their own itinerary', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Mine',
      userId: OWNER_ID,
    });
    prisma.itinerary.delete.mockResolvedValue({});
    await service.remove(OWNER_ID, ITINERARY_ID);
    expect(prisma.itinerary.delete).toHaveBeenCalledWith({ where: { id: ITINERARY_ID } });
  });

  it('404s when adding a missing landmark to an owned itinerary', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Mine',
      userId: OWNER_ID,
    });
    prisma.landmark.findUnique.mockResolvedValue(null);
    await expect(service.addLandmark(OWNER_ID, ITINERARY_ID, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.itineraryLandmark.upsert).not.toHaveBeenCalled();
  });

  it('adds a landmark when the owner and landmark are valid', async () => {
    prisma.itinerary.findUnique.mockResolvedValue({
      id: ITINERARY_ID,
      name: 'Mine',
      userId: OWNER_ID,
    });
    prisma.landmark.findUnique.mockResolvedValue({ id: 5 });
    prisma.itineraryLandmark.upsert.mockResolvedValue({});
    await service.addLandmark(OWNER_ID, ITINERARY_ID, 5);
    expect(prisma.itineraryLandmark.upsert).toHaveBeenCalledWith({
      where: { itineraryId_landmarkId: { itineraryId: ITINERARY_ID, landmarkId: 5 } },
      create: { itineraryId: ITINERARY_ID, landmarkId: 5 },
      update: {},
    });
  });
});
