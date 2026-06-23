import { IsInt, Min } from 'class-validator';

export class AddLandmarkDto {
  @IsInt()
  @Min(1)
  landmarkId!: number;
}
