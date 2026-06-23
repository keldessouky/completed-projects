import { NotFoundException } from '@nestjs/common';
import { LandmarksService } from './landmarks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LandmarksService', () => {
  let service: LandmarksService;
  let prisma: { landmark: { findUnique: jest.Mock; findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { landmark: { findUnique: jest.fn(), findMany: jest.fn() } };
    service = new LandmarksService(prisma as unknown as PrismaService);
  });

  it('flattens the image join rows into a string array', async () => {
    prisma.landmark.findUnique.mockResolvedValue({
      id: 1,
      name: 'Colosseum',
      summary: 's',
      description: 'd',
      img: 'colosseum-main.jpg',
      mapLink: null,
      addressId: 1,
      images: [{ imageName: 'a.jpg' }, { imageName: 'b.jpg' }],
    });

    const result = await service.findOne(1);

    expect(result.images).toEqual(['a.jpg', 'b.jpg']);
    expect(result.name).toBe('Colosseum');
  });

  it('throws 404 for a missing landmark instead of returning null', async () => {
    prisma.landmark.findUnique.mockResolvedValue(null);
    await expect(service.findOne(123)).rejects.toBeInstanceOf(NotFoundException);
  });
});
