import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const pendingRequests = await db.membershipRequest.findMany({
    where: { status: 'pending' },
  })

  const req = pendingRequests[0];
  if (!req) {
    console.log('No pending requests found. Are you sure you tried logging in?')
    return
  }
  console.log(`Found pending request for ${req.email}. Promoting to admin...`)

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: req.email,
        name: req.name,
        avatarUrl: req.avatarUrl,
        role: 'admin',
        status: 'active',
        joinedAt: new Date(),
      },
    })

    await tx.membershipRequest.update({
      where: { id: req.id },
      data: {
        status: 'approved',
        userId: user.id,
        reviewedAt: new Date(),
        // Since this is the first admin, there's no "reviewedBy" user to set
      },
    })
    
    // Also create their meal pattern
    await tx.mealPattern.create({
      data: {
        userId: user.id,
      }
    })

    console.log(`User ${user.email} has been approved and promoted to admin.`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
