import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Image, Landmark } from '@prisma/client';
import { CreateLandmarkDto } from './dto/create-landmark.dto';
import { LandmarkResponse } from './landmark.entity';
import { PrismaService } from '../prisma/prisma.service';

export type LandmarkWithImages = Landmark & { images: Image[] };

@Injectable()
export class LandmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<LandmarkResponse[]> {
    const landmarks = await this.prisma.landmark.findMany({
      include: { images: true },
      orderBy: { id: 'asc' },
    });
    return landmarks.map((l) => this.toResponse(l));
  }

  /** Returns a clean 404 when the landmark is missing (original threw a 500). */
  async findOne(id: number): Promise<LandmarkResponse> {
    const landmark = await this.prisma.landmark.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!landmark) {
      throw new NotFoundException(`Landmark ${id} not found`);
    }
    return this.toResponse(landmark);
  }

  async create(dto: CreateLandmarkDto): Promise<LandmarkResponse> {
    // Validate the FK target up front so a bad addressId yields a clean 400
    // instead of a Prisma foreign-key error surfacing as a 500.
    const address = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
    if (!address) {
      throw new BadRequestException(`Address ${dto.addressId} does not exist`);
    }

    const landmark = await this.prisma.landmark.create({
      data: {
        name: dto.name,
        summary: dto.summary,
        description: dto.description,
        img: dto.img,
        mapLink: dto.mapLink ?? null,
        addressId: dto.addressId,
      },
      include: { images: true },
    });
    return this.toResponse(landmark);
  }

  /** Shared mapper so every endpoint returns landmarks in the same shape. */
  toResponse(landmark: LandmarkWithImages): LandmarkResponse {
    return {
      id: landmark.id,
      name: landmark.name,
      summary: landmark.summary,
      description: landmark.description,
      img: landmark.img,
      mapLink: landmark.mapLink,
      addressId: landmark.addressId,
      images: landmark.images.map((image) => image.imageName),
    };
  }
}
