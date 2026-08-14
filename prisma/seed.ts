import { PrismaClient, CampusType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial campuses...");

  // Sample campuses with standard GeoJSON Polygons (e.g. coordinates: [lng, lat])
  const campuses = [
    {
      name: "Downtown University Campus",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [-122.42, 37.77],
            [-122.40, 37.77],
            [-122.40, 37.79],
            [-122.42, 37.79],
            [-122.42, 37.77],
          ],
        ],
      },
    },
    {
      name: "North Tech College Campus",
      type: CampusType.COLLEGE,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [-122.45, 37.80],
            [-122.43, 37.80],
            [-122.43, 37.82],
            [-122.45, 37.82],
            [-122.45, 37.80],
          ],
        ],
      },
    },
    {
      name: "Innovation Research Park",
      type: CampusType.CAMPUS,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [-122.38, 37.75],
            [-122.36, 37.75],
            [-122.36, 37.77],
            [-122.38, 37.77],
            [-122.38, 37.75],
          ],
        ],
      },
    },
  ];

  for (const campus of campuses) {
    const existing = await prisma.campus.findFirst({
      where: { name: campus.name },
    });

    if (!existing) {
      await prisma.campus.create({
        data: campus,
      });
      console.log(`Created campus: ${campus.name}`);
    } else {
      console.log(`Campus already exists: ${campus.name}`);
    }
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
