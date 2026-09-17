const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning database...')
  await prisma.attendanceRecord.deleteMany()
  await prisma.timetableSlot.deleteMany()
  await prisma.course.deleteMany()

  console.log('Seeding courses...')

  // Realistic B.Tech Semester courses
  const coursesData = [
    {
      name: 'Engineering Physics',
      code: 'PHY1001',
      requiredPercent: 75.0,
      color: '#3b82f6', // Blue
      slots: [
        { weekday: 1, label: '09:00 - 10:00', room: 'AB4 403' }, // Mon
        { weekday: 3, label: '11:00 - 12:00', room: 'AB4 403' }, // Wed
        { weekday: 5, label: '10:00 - 11:00', room: 'AB4 403' }, // Fri
      ],
      attendance: [
        { date: '2026-09-01', status: 'present' },
        { date: '2026-09-03', status: 'present' },
        { date: '2026-09-05', status: 'present' },
        { date: '2026-09-08', status: 'present' },
        { date: '2026-09-10', status: 'present' },
        { date: '2026-09-12', status: 'absent', note: 'Doctor appointment' },
        { date: '2026-09-15', status: 'present' },
      ],
    },
    {
      name: 'Linear Algebra & Calculus',
      code: 'MAT1001',
      requiredPercent: 75.0,
      color: '#8b5cf6', // Violet
      slots: [
        { weekday: 1, label: '10:00 - 11:00', room: 'AB4 403' },
        { weekday: 2, label: '09:00 - 10:00', room: 'AB4 403' },
        { weekday: 4, label: '14:00 - 15:00', room: 'AB4 403' },
      ],
      attendance: [
        { date: '2026-09-01', status: 'present' },
        { date: '2026-09-02', status: 'present' },
        { date: '2026-09-04', status: 'absent' },
        { date: '2026-09-08', status: 'present' },
        { date: '2026-09-09', status: 'present' },
        { date: '2026-09-11', status: 'present' },
        { date: '2026-09-15', status: 'present' },
        { date: '2026-09-16', status: 'present' },
      ],
    },
    {
      name: 'Problem Solving Using Computers',
      code: 'CSE1001',
      requiredPercent: 75.0,
      color: '#10b981', // Emerald
      slots: [
        { weekday: 2, label: '11:00 - 12:00', room: 'AB4 403' },
        { weekday: 3, label: '14:00 - 16:00', room: 'CS Lab 2' },
        { weekday: 5, label: '09:00 - 10:00', room: 'AB4 403' },
      ],
      attendance: [
        { date: '2026-09-02', status: 'present' },
        { date: '2026-09-03', status: 'present' },
        { date: '2026-09-05', status: 'present' },
        { date: '2026-09-09', status: 'present' },
        { date: '2026-09-10', status: 'present' },
        { date: '2026-09-12', status: 'present' },
        { date: '2026-09-16', status: 'present' },
      ],
    },
    {
      name: 'Basic Electrical & Electronics',
      code: 'ELE1001',
      requiredPercent: 75.0,
      color: '#f59e0b', // Amber
      slots: [
        { weekday: 1, label: '14:00 - 15:00', room: 'AB4 403' },
        { weekday: 3, label: '09:00 - 10:00', room: 'AB4 403' },
        { weekday: 4, label: '11:00 - 12:00', room: 'AB4 403' },
      ],
      attendance: [
        { date: '2026-09-01', status: 'absent', note: 'Late train' },
        { date: '2026-09-03', status: 'absent' },
        { date: '2026-09-04', status: 'present' },
        { date: '2026-09-08', status: 'present' },
        { date: '2026-09-10', status: 'present' },
        { date: '2026-09-11', status: 'absent' },
        { date: '2026-09-15', status: 'present' },
      ],
    },
    {
      name: 'Workshop Practice',
      code: 'MEC1001',
      requiredPercent: 75.0,
      color: '#ec4899', // Pink
      slots: [
        { weekday: 4, label: '09:00 - 12:00', room: 'Central Workshop' },
      ],
      attendance: [
        { date: '2026-09-04', status: 'present' },
        { date: '2026-09-11', status: 'present' },
      ],
    },
  ]

  for (const item of coursesData) {
    const course = await prisma.course.create({
      data: {
        name: item.name,
        code: item.code,
        requiredPercent: item.requiredPercent,
        color: item.color,
      },
    })

    for (const slot of item.slots) {
      await prisma.timetableSlot.create({
        data: {
          courseId: course.id,
          weekday: slot.weekday,
          label: slot.label,
          room: slot.room,
        },
      })
    }

    for (const rec of item.attendance) {
      await prisma.attendanceRecord.create({
        data: {
          courseId: course.id,
          date: rec.date,
          status: rec.status,
          note: rec.note || null,
        },
      })
    }
  }

  console.log('Seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
