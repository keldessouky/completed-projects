import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { LandmarksModule } from './landmarks/landmarks.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    UsersModule,
    AuthModule,
    LandmarksModule,
    ItinerariesModule,
    HealthModule,
  ],
  providers: [
    // Consistent JSON error envelopes; logs unexpected 500s.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
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
