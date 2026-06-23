import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { LandmarksModule } from './landmarks/landmarks.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    LandmarksModule,
    ItinerariesModule,
  ],
  providers: [
    // Authentication is global: every route requires a valid JWT unless it is
    // explicitly marked @Public(). This is the inverse of the original app.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
