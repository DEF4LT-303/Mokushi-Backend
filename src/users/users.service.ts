import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return this.databaseService.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
  }

  findAll(role?: Role) {
    return this.databaseService.user.findMany({
      where: {
        role: role ? { equals: role } : undefined,
      },
    });
  }

  findById(id: string) {
    return this.databaseService.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.databaseService.user.findUnique({
      where: { email },
    });
  }

  update(id: string, updateUserDto: Prisma.UserUpdateInput) {
    return this.databaseService.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  remove(id: string) {
    return this.databaseService.user.delete({
      where: { id },
    });
  }

  async findOrCreateGoogleUser(googleProfile: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
  }) {
    const { email, firstName, lastName, picture } = googleProfile;

    // Check if user already exists
    let user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user with Google profile data
      // For now, use the name field as a fallback since firstName/lastName might not exist yet
      const fullName = `${firstName} ${lastName}`.trim();

      user = await this.databaseService.user.create({
        data: {
          email,
          fullName,
          firstName,
          lastName,
          picture,
          provider: 'google'
        },
      });
    } else {
      // Update existing user's name if it changed
      const fullName = `${firstName} ${lastName}`.trim();
      if (user.fullName !== fullName) {
        user = await this.databaseService.user.update({
          where: { id: user.id },
          data: { fullName },
        });
      }
    }

    return user;
  }
}
