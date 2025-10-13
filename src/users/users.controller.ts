import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { SafeUser } from 'prisma/safe-user.select';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { isAdmin } from 'src/common/utils/role.helpers';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ description: 'User created successfully' })
  @ApiBody({ type: CreateUserDto })
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({ description: 'List of all users' })
  @ApiNotFoundResponse({ description: 'No users found' })
  async findAll() {
    const users = await this.usersService.findAll();
    if (!users.length) {
      throw new HttpException('No users found', HttpStatus.NOT_FOUND);
    }
    return users;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkResponse({ description: 'User fetched successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiBody({ type: UpdateUserDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: SafeUser
  ) {
    // Check if current user is the owner or an admin
    if (currentUser.id !== id && !isAdmin(currentUser.role)) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    try {
      return await this.usersService.update(id, updateUserDto);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new HttpException('Email already exists', HttpStatus.CONFLICT);
        }
      }
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async remove(@Param('id') id: string, @CurrentUser() currentUser: SafeUser) {
    // Check if current user is the owner or an admin
    if (currentUser.id !== id && !isAdmin(currentUser.role)) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return this.usersService.remove(id);
  }
}
