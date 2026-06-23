import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateLandmarkDto } from './dto/create-landmark.dto';
import { LandmarkResponse } from './landmark.entity';
import { LandmarksService } from './landmarks.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('landmarks')
export class LandmarksController {
  constructor(private readonly landmarks: LandmarksService) {}

  @Public()
  @Get()
  findAll(): Promise<LandmarkResponse[]> {
    return this.landmarks.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<LandmarkResponse> {
    return this.landmarks.findOne(id);
  }

  /** Creating catalog entries is admin-only (enforced by the global RolesGuard). */
  @Roles('ROLE_ADMIN')
  @Post()
  create(@Body() dto: CreateLandmarkDto): Promise<LandmarkResponse> {
    return this.landmarks.create(dto);
  }
}
