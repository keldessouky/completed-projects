/**
 * Seeds the database with demo landmarks, addresses, images, and two accounts.
 *
 * Idempotent: it clears the tables it owns first, so it can be re-run safely.
 *
 * Demo accounts (both use the password `password`):
 *   - user  / password   (ROLE_USER)
 *   - admin / password   (ROLE_ADMIN)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Precomputed bcrypt hash (cost 8) for the demo password `password`.
const DEMO_HASH = '$2a$08$UkVvwpULis18S19S5pZFn.YHPZt3oaqHZnDwqbCW9pft6uFtkXKDC';

const addresses = [
  { street: 'Piazza del Colosseo', buildingNum: 1, postalCode: 184, city: 'Rome', country: 'Italy' },
  { street: 'Piazza di Trevi', buildingNum: null, postalCode: 187, city: 'Rome', country: 'Italy' },
  { street: 'Piazza di Spagna', buildingNum: null, postalCode: 187, city: 'Rome', country: 'Italy' },
  { street: 'Piazza della Rotonda', buildingNum: null, postalCode: 186, city: 'Rome', country: 'Italy' },
  { street: 'Via della Salara Vecchia', buildingNum: 5, postalCode: 186, city: 'Rome', country: 'Italy' },
  { street: 'Piazza Navona', buildingNum: null, postalCode: 186, city: 'Rome', country: 'Italy' },
  { street: 'Città del Vaticano', buildingNum: null, postalCode: null, city: 'Vatican City', country: 'Vatican City' },
  { street: null, buildingNum: null, postalCode: 120, city: 'Vatican City', country: 'Vatican City' },
  { street: 'Piazza Venezia', buildingNum: null, postalCode: null, city: 'Rome', country: 'Italy' },
];

// Landmark data keyed by the 1-based address index above. `images` lists the
// gallery images (image_name) for each landmark.
const landmarks = [
  {
    name: 'Colosseum',
    summary: 'Iconic ancient Roman gladiatorial arena',
    description:
      'The Colosseum or Coliseum, also known as the Flavian Amphitheatre, is an oval amphitheatre in the centre of the city of Rome, Italy. Built of travertine limestone, tuff, and brick-faced concrete, it was the largest amphitheatre ever built at the time and held 50,000 to 80,000 spectators.',
    img: 'colosseum-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2970.1230738089853!2d12.490042215661843!3d41.890210179221214!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f61b6532013ad%3A0x28f1c82e908503c4!2sColosseum!5e0!3m2!1sen!2sus!4v1597086508274!5m2!1sen!2sus',
    addressIndex: 1,
    images: ['colosseum-1.jpg', 'colosseum-2.jpg', 'colosseum-3.jpg', 'colosseum-4.jpg', 'colosseum-5.jpg'],
  },
  {
    name: 'Trevi Fountain',
    summary: 'Iconic 18th century sculpted fountain',
    description:
      'The Trevi Fountain is a fountain in the Trevi district in Rome, Italy, designed by Italian architect Nicola Salvi and completed by Giuseppe Pannini and several others. Standing 26.3 metres high and 49.15 metres wide, it is the largest Baroque fountain in the city and one of the most famous fountains in the world.',
    img: 'trevi-fountain-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2969.6197902371746!2d12.481084265662115!3d41.90103327922048!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f6053278340d5%3A0xf676f1e1cc02bbb6!2sTrevi%20Fountain!5e0!3m2!1sen!2sus!4v1597093213427!5m2!1sen!2sus',
    addressIndex: 2,
    images: ['trevi-fountain-1.jpg', 'trevi-fountain-2.jpg', 'trevi-fountain-3.jpg', 'trevi-fountain-4.jpg', 'trevi-fountain-5.jpg'],
  },
  {
    name: 'Spanish Steps',
    summary: 'Iconic baroque starway and meeting place',
    description:
      'The Spanish Steps are a set of steps in Rome, Italy, climbing a steep slope between the Piazza di Spagna at the base and Piazza Trinità dei Monti, dominated by the Trinità dei Monti church at the top.',
    img: 'spanish-steps-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2969.389515149601!2d12.480565665662265!3d41.905984579219805!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f60541678ae75%3A0x7fc0d4978aae690f!2sSpanish%20Steps!5e0!3m2!1sen!2sus!4v1597093369444!5m2!1sen!2sus',
    addressIndex: 3,
    images: ['spanish-steps-1.jpg', 'spanish-steps-2.jpg', 'spanish-steps-3.jpg', 'spanish-steps-4.jpg', 'spanish-steps-5.jpg'],
  },
  {
    name: 'Pantheon',
    summary: 'Landmark Roman church and historic tombs',
    description:
      'The Pantheon is a former Roman temple, now a Catholic church, in Rome, Italy, on the site of an earlier temple commissioned by Marcus Agrippa during the reign of Augustus. It was rebuilt by the emperor Hadrian and probably dedicated about 126 AD.',
    img: 'pantheon-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2969.7324478011583!2d12.474684215662!3d41.89861077922055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f604f678640a9%3A0xcad165fa2036ce2c!2sPantheon!5e0!3m2!1sen!2sus!4v1597093458820!5m2!1sen!2sus',
    addressIndex: 4,
    images: ['pantheon-1.jpg', 'pantheon-2.jpg', 'pantheon-3.jpg', 'pantheon-4.jpg', 'pantheon-5.jpg'],
  },
  {
    name: 'Roman Forum',
    summary: 'Excabated heart of the Roman Empire',
    description:
      'The Roman Forum, also known by its Latin name Forum Romanum, is a rectangular forum surrounded by the ruins of several important ancient government buildings at the center of the city of Rome. Citizens of the ancient city referred to this space, originally a marketplace, as the Forum Magnum, or simply the Forum.',
    img: 'roman-forum-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2970.0183579299696!2d12.483136315661856!3d41.892462279221!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f61b383a9cdef%3A0xfa914007c0ec7de6!2sRoman%20Forum!5e0!3m2!1sen!2sus!4v1597093519664!5m2!1sen!2sus',
    addressIndex: 5,
    images: ['roman-forum-1.jpg', 'roman-forum-2.jpg', 'roman-forum-3.jpg', 'roman-forum-4.jpg', 'roman-forum-5.jpg'],
  },
  {
    name: 'Piazza Navona',
    summary: 'Elegant square with a fountain and bars',
    description:
      'Piazza Navona is a public open space in Rome, Italy. It is built on the site of the Stadium of Domitian, built in the 1st century AD, and follows the form of the open space of the stadium. The ancient Romans went there to watch the agones, and hence it was known as "Circus Agonalis".',
    img: 'piazza-navona-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2969.706754438092!2d12.470885515662035!3d41.8991632792205!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f6083c19d1c3d%3A0xa35724562e82334a!2sPiazza%20Navona!5e0!3m2!1sen!2sus!4v1597093622318!5m2!1sen!2sus',
    addressIndex: 6,
    images: ['piazza-navona-1.jpg', 'piazza-navona-2.jpg', 'piazza-navona-3.jpg', 'piazza-navona-4.jpg', 'piazza-navona-5.jpg'],
  },
  {
    name: "Saint Peter's Square",
    summary: 'Religous plaza with a fountain and obelisk',
    description:
      "St. Peter's Square is a large plaza located directly in front of St. Peter's Basilica in the Vatican City, the papal enclave inside Rome, directly west of the neighborhood or rione of Borgo. Both the square and the basilica are named after Saint Peter, an apostle of Jesus considered by Catholics to be the first Pope.",
    img: 'saint-peters-square-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1484.78204677911!2d12.455692708276477!3d41.90223089480502!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f6067b0ad3535%3A0xb0be9b5b5aad7258!2sPiazza%20San%20Pietro%2C%20Citt%C3%A0%20del%20Vaticano%2C%20Vatican%20City!5e0!3m2!1sen!2sus!4v1597093765545!5m2!1sen!2sus',
    addressIndex: 7,
    images: ['saint-peters-square-1.jpg', 'saint-peters-square-2.jpg', 'saint-peters-square-3.jpg', 'saint-peters-square-4.jpg', 'saint-peters-square-5.jpg'],
  },
  {
    name: 'Sistine Chapel',
    summary: "Michelangelo's iconic painted ceiling",
    description:
      'The Sistine Chapel is a chapel in the Apostolic Palace, the official residence of the pope, in Vatican City. Originally known as the Cappella Magna, the chapel takes its name from Pope Sixtus IV, who restored it between 1473 and 1481. Since that time, the chapel has served as a place of both religious and functionary papal activity.',
    img: 'sistine-chapel-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1484.7653995364515!2d12.453389158244331!3d41.90294679480508!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f6065c523afdb%3A0xab16c8877fb53e22!2sSistine%20Chapel!5e0!3m2!1sen!2sus!4v1597093830858!5m2!1sen!2sus',
    addressIndex: 8,
    images: ['sistine-chapel-1.jpg', 'sistine-chapel-2.jpg', 'sistine-chapel-3.jpg', 'sistine-chapel-4.jpg', 'sistine-chapel-5.jpg'],
  },
  {
    name: 'Victor Emmanuel',
    summary: 'White marble memorial monument',
    description:
      'The Victor Emmanuel II National Monument or Vittoriano, called Altare della Patria, is a national monument built in honour of Victor Emmanuel II, the first king of a unified Italy, located in Rome, Italy.',
    img: 'victor-emmanuel-monument-main.jpg',
    mapLink:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1484.9566323685779!2d12.481915008276415!3d41.89472239480519!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x132f604d1b805de3%3A0x21154807a7b83fe1!2sAltar%20of%20the%20Fatherland!5e0!3m2!1sen!2sus!4v1597093909087!5m2!1sen!2sus',
    addressIndex: 9,
    images: ['victor-emmanuel-monument-1.jpg', 'victor-emmanuel-monument-2.jpg', 'victor-emmanuel-monument-3.jpg', 'victor-emmanuel-monument-4.jpg', 'victor-emmanuel-monument-5.jpg'],
  },
];

async function main(): Promise<void> {
  // Clear in FK-safe order so the seed is idempotent.
  await prisma.itineraryLandmark.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.image.deleteMany();
  await prisma.landmark.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { username: 'user', passwordHash: DEMO_HASH, role: 'ROLE_USER' },
  });
  await prisma.user.create({
    data: { username: 'admin', passwordHash: DEMO_HASH, role: 'ROLE_ADMIN' },
  });

  // Insert addresses and remember their generated ids by 1-based index.
  const addressIdByIndex: Record<number, number> = {};
  for (let i = 0; i < addresses.length; i++) {
    const created = await prisma.address.create({ data: addresses[i] });
    addressIdByIndex[i + 1] = created.id;
  }

  // Insert landmarks (with nested images) and remember their ids by 1-based index.
  const landmarkIdByIndex: Record<number, number> = {};
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i];
    const created = await prisma.landmark.create({
      data: {
        name: l.name,
        summary: l.summary,
        description: l.description,
        img: l.img,
        mapLink: l.mapLink,
        addressId: addressIdByIndex[l.addressIndex],
        images: { create: l.images.map((imageName) => ({ imageName })) },
      },
    });
    landmarkIdByIndex[i + 1] = created.id;
  }

  // Two starter itineraries for the demo `user`.
  const historic = await prisma.itinerary.create({
    data: { name: 'Historic Ruins', userId: user.id },
  });
  const publicSpaces = await prisma.itinerary.create({
    data: { name: 'Cool Public Spaces', userId: user.id },
  });

  const itineraryLandmarks: Array<{ itineraryId: number; landmarkIndex: number }> = [
    { itineraryId: historic.id, landmarkIndex: 1 },
    { itineraryId: historic.id, landmarkIndex: 4 },
    { itineraryId: historic.id, landmarkIndex: 5 },
    { itineraryId: publicSpaces.id, landmarkIndex: 2 },
    { itineraryId: publicSpaces.id, landmarkIndex: 3 },
    { itineraryId: publicSpaces.id, landmarkIndex: 6 },
    { itineraryId: publicSpaces.id, landmarkIndex: 7 },
  ];
  await prisma.itineraryLandmark.createMany({
    data: itineraryLandmarks.map((il) => ({
      itineraryId: il.itineraryId,
      landmarkId: landmarkIdByIndex[il.landmarkIndex],
    })),
  });

  console.log('Seed complete: 2 users, 9 landmarks, 2 itineraries.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
