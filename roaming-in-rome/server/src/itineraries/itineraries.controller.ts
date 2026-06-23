import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Itinerary } from '@prisma/client';
import { AddLandmarkDto } from './dto/add-landmark.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ItinerariesService } from './itineraries.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LandmarkResponse } from '../landmarks/landmark.entity';

/**
 * Every route here is protected by the global JwtAuthGuard. The owning user is
 * always taken from the token (`@CurrentUser('id')`), never from a path or body
 * parameter — which is what made the original endpoints vulnerable to IDOR.
 */
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly itineraries: ItinerariesService) {}

  @Get()
  findMine(@CurrentUser('id') userId: number): Promise<Itinerary[]> {
    return this.itineraries.findAllForUser(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateItineraryDto,
  ): Promise<Itinerary> {
    return this.itineraries.create(userId, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.itineraries.remove(userId, id);
  }

  @Get(':id/landmarks')
  getLandmarks(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LandmarkResponse[]> {
    return this.itineraries.getLandmarks(userId, id);
  }

  @Post(':id/landmarks')
  @HttpCode(HttpStatus.NO_CONTENT)
  addLandmark(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddLandmarkDto,
  ): Promise<void> {
    return this.itineraries.addLandmark(userId, id, dto.landmarkId);
  }

  @Delete(':id/landmarks/:landmarkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLandmark(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('landmarkId', ParseIntPipe) landmarkId: number,
  ): Promise<void> {
    return this.itineraries.removeLandmark(userId, id, landmarkId);
  }
}
