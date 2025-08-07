// app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json()

    // 1) Validate
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (role && !['ADMIN','CUSTOMER'].includes(role)) {
      return NextResponse.json({ error: 'Role must be ADMIN or CUSTOMER' }, { status: 400 })
    }

    // 2) Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    // 3) Hash & create
    const hashed = await hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: role ?? 'CUSTOMER',
      },
    })

    // 4) Return safe payload
    const safe = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    }
    return NextResponse.json(safe, { status: 201 })

  } catch (err) {
    console.error('Signup error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
