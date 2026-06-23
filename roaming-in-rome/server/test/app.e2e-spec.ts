import './setup-e2e';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end tests against the real HTTP stack and a real (test) Postgres
 * database. They assert feature parity and, crucially, the access-control
 * behavior the original app lacked.
 */
describe('Roaming in Rome API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Seeded landmark id, captured during setup.
  let landmarkId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean slate, then seed one address + landmark to exercise landmark routes.
    await prisma.itineraryLandmark.deleteMany();
    await prisma.itinerary.deleteMany();
    await prisma.image.deleteMany();
    await prisma.landmark.deleteMany();
    await prisma.address.deleteMany();
    await prisma.user.deleteMany();

    const address = await prisma.address.create({ data: { city: 'Rome', country: 'Italy' } });
    const landmark = await prisma.landmark.create({
      data: {
        name: 'Colosseum',
        summary: 'Iconic arena',
        description: 'An oval amphitheatre in the centre of Rome.',
        img: 'colosseum-main.jpg',
        addressId: address.id,
        images: { create: [{ imageName: 'colosseum-1.jpg' }] },
      },
    });
    landmarkId = landmark.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('auth', () => {
    it('registers a user and forces ROLE_USER even if a role is supplied', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ username: 'alice', password: 'password123', role: 'ROLE_ADMIN' })
        .expect(400); // forbidNonWhitelisted rejects the stray `role` field

      expect(res.body.message).toBeDefined();

      await http()
        .post('/auth/register')
        .send({ username: 'alice', password: 'password123' })
        .expect(201)
        .expect((r) => {
          expect(r.body).toEqual({ id: expect.any(Number), username: 'alice', role: 'ROLE_USER' });
          expect(r.body).not.toHaveProperty('passwordHash');
        });
    });

    it('rejects duplicate registration with 409', async () => {
      await http()
        .post('/auth/register')
        .send({ username: 'alice', password: 'password123' })
        .expect(409);
    });

    it('logs in and returns a token', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ username: 'alice', password: 'password123' })
        .expect(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({ id: expect.any(Number), username: 'alice', role: 'ROLE_USER' });
    });

    it('rejects a bad password with 401', async () => {
      await http()
        .post('/auth/login')
        .send({ username: 'alice', password: 'wrong' })
        .expect(401);
    });
  });

  describe('landmarks', () => {
    it('lists landmarks without authentication (public)', async () => {
      const res = await http().get('/landmarks').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('images');
    });

    it('returns 404 for a missing landmark (not a 500)', async () => {
      await http().get('/landmarks/99999').expect(404);
    });

    it('forbids non-admins from creating landmarks', async () => {
      const token = await loginToken('alice', 'password123');
      await http()
        .post('/landmarks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'X',
          summary: 's',
          description: 'd',
          img: 'x.jpg',
          addressId: 1,
        })
        .expect(403);
    });
  });

  describe('itineraries (auth + ownership)', () => {
    it('requires authentication', async () => {
      await http().get('/itineraries').expect(401);
    });

    it('scopes itineraries to the authenticated user and blocks cross-user access', async () => {
      // Two separate users.
      await http().post('/auth/register').send({ username: 'bob', password: 'password123' });
      await http().post('/auth/register').send({ username: 'mallory', password: 'password123' });
      const bob = await loginToken('bob', 'password123');
      const mallory = await loginToken('mallory', 'password123');

      // Bob creates an itinerary.
      const created = await http()
        .post('/itineraries')
        .set('Authorization', `Bearer ${bob}`)
        .send({ name: 'Bob trip' })
        .expect(201);
      const itineraryId = created.body.id as number;

      // Bob sees it; Mallory does not.
      const bobList = await http()
        .get('/itineraries')
        .set('Authorization', `Bearer ${bob}`)
        .expect(200);
      expect(bobList.body).toHaveLength(1);

      const malloryList = await http()
        .get('/itineraries')
        .set('Authorization', `Bearer ${mallory}`)
        .expect(200);
      expect(malloryList.body).toHaveLength(0);

      // Mallory cannot read, mutate, or delete Bob's itinerary (the IDOR).
      await http()
        .get(`/itineraries/${itineraryId}/landmarks`)
        .set('Authorization', `Bearer ${mallory}`)
        .expect(403);
      await http()
        .post(`/itineraries/${itineraryId}/landmarks`)
        .set('Authorization', `Bearer ${mallory}`)
        .send({ landmarkId })
        .expect(403);
      await http()
        .delete(`/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${mallory}`)
        .expect(403);

      // Bob can add and list landmarks on his own itinerary.
      await http()
        .post(`/itineraries/${itineraryId}/landmarks`)
        .set('Authorization', `Bearer ${bob}`)
        .send({ landmarkId })
        .expect(204);
      const landmarks = await http()
        .get(`/itineraries/${itineraryId}/landmarks`)
        .set('Authorization', `Bearer ${bob}`)
        .expect(200);
      expect(landmarks.body).toHaveLength(1);
      expect(landmarks.body[0].id).toBe(landmarkId);

      // Bob removes the landmark and deletes the itinerary.
      await http()
        .delete(`/itineraries/${itineraryId}/landmarks/${landmarkId}`)
        .set('Authorization', `Bearer ${bob}`)
        .expect(204);
      await http()
        .delete(`/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${bob}`)
        .expect(204);
    });
  });

  async function loginToken(username: string, password: string): Promise<string> {
    const res = await http().post('/auth/login').send({ username, password }).expect(200);
    return res.body.token as string;
  }
});
