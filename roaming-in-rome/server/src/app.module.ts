import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
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
    // explicitly marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Authorization is global too: @Roles(...) is enforced everywhere by
    // construction, so a new admin route can't accidentally ship unguarded.
    // Runs after JwtAuthGuard, so request.user is populated; routes without
    // @Roles are allowed through.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
