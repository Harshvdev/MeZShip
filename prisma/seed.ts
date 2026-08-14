import { PrismaClient, CampusType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });




async function main() {
  console.log("Seeding real campuses...");

  // Real campuses with standard GeoJSON Polygons [lng, lat]
  const campuses = [
    {
      name: "Goel Institute of Technology & Management (GITM), Lucknow",
      type: CampusType.COLLEGE,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [81.064, 26.884],
            [81.080, 26.884],
            [81.080, 26.898],
            [81.064, 26.898],
            [81.064, 26.884],
          ],
        ],
      },
    },
    {
      name: "Babu Banarasi Das University (BBDU), Lucknow",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [81.048, 26.880],
            [81.063, 26.880],
            [81.063, 26.896],
            [81.048, 26.896],
            [81.048, 26.880],
          ],
        ],
      },
    },
    {
      name: "Institute of Engineering and Technology (IET), Lucknow",
      type: CampusType.COLLEGE,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.932, 26.906],
            [80.950, 26.906],
            [80.950, 26.922],
            [80.932, 26.922],
            [80.932, 26.906],
          ],
        ],
      },
    },
    {
      name: "Amity University, Lucknow Campus",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [81.008, 26.853],
            [81.028, 26.853],
            [81.028, 26.870],
            [81.008, 26.870],
            [81.008, 26.853],
          ],
        ],
      },
    },
    {
      name: "Integral University, Lucknow",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.988, 26.950],
            [81.010, 26.950],
            [81.010, 26.970],
            [80.988, 26.970],
            [80.988, 26.950],
          ],
        ],
      },
    },
    {
      name: "University of Lucknow (LU)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.925, 26.856],
            [80.948, 26.856],
            [80.948, 26.874],
            [80.925, 26.874],
            [80.925, 26.856],
          ],
        ],
      },
    },
    {
      name: "Dr. Ram Manohar Lohiya National Law University (RMLNLU), Lucknow",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.888, 26.782],
            [80.910, 26.782],
            [80.910, 26.800],
            [80.888, 26.800],
            [80.888, 26.782],
          ],
        ],
      },
    },
    {
      name: "Indian Institute of Technology Kanpur (IIT Kanpur)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.215, 26.498],
            [80.252, 26.498],
            [80.252, 26.532],
            [80.215, 26.532],
            [80.215, 26.498],
          ],
        ],
      },
    },
    {
      name: "Harcourt Butler Technical University (HBTU Kanpur)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.292, 26.478],
            [80.328, 26.478],
            [80.328, 26.508],
            [80.292, 26.508],
            [80.292, 26.478],
          ],
        ],
      },
    },
    {
      name: "Chhatrapati Shahu Ji Maharaj University (CSJMU Kanpur)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.268, 26.482],
            [80.298, 26.482],
            [80.298, 26.512],
            [80.268, 26.512],
            [80.268, 26.482],
          ],
        ],
      },
    },
    {
      name: "GSVM Medical College & Kanpur City Campus",
      type: CampusType.COLLEGE,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.300, 26.440],
            [80.365, 26.440],
            [80.365, 26.490],
            [80.300, 26.490],
            [80.300, 26.440],
          ],
        ],
      },
    },
    {
      name: "Pranveer Singh Institute of Technology (PSIT Kanpur)",
      type: CampusType.COLLEGE,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [80.182, 26.432],
            [80.212, 26.432],
            [80.212, 26.458],
            [80.182, 26.458],
            [80.182, 26.432],
          ],
        ],
      },
    },
    {
      name: "Indian Institute of Technology Delhi (IIT Delhi)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [77.180, 28.535],
            [77.205, 28.535],
            [77.205, 28.555],
            [77.180, 28.555],
            [77.180, 28.535],
          ],
        ],
      },
    },
    {
      name: "Indian Institute of Technology Bombay (IIT Bombay)",
      type: CampusType.UNIVERSITY,
      active: true,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [72.900, 19.120],
            [72.928, 19.120],
            [72.928, 19.148],
            [72.900, 19.148],
            [72.900, 19.120],
          ],
        ],
      },
    },
  ];

  // Remove any legacy dummy placeholder campuses
  await prisma.campus.deleteMany({
    where: {
      name: {
        in: [
          "Downtown University Campus",
          "North Tech College Campus",
          "Innovation Research Park",
        ],
      },
    },
  });

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
      await prisma.campus.update({
        where: { id: existing.id },
        data: campus,
      });
      console.log(`Updated campus: ${campus.name}`);
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

