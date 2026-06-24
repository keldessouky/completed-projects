import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLandmarkDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(128)
  summary!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsString()
  @MaxLength(64)
  img!: string;

  @IsInt()
  @Min(1)
  addressId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mapLink?: string;
}
