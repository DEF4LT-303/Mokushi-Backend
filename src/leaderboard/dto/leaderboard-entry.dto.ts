import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'User ID', example: 'd8fd1550-887e-4ea7-9b9f-08c830c40913' })
  userId!: string;

  @ApiProperty({ description: 'User full name', example: 'Ryan Rafi' })
  name!: string;

  @ApiProperty({ description: 'Profile picture URL, if available', example: 'https://lh3.googleusercontent.com/a/ACg8ocKcQb67iF7607Vh5FSYhyivOFecimR1YVlsw_zu9Qyo4qi9RGOl=s96-c', nullable: true })
  picture!: string | null;

  @ApiProperty({ description: 'Average score', example: 2.5 })
  avgScore!: number;

  @ApiProperty({ description: 'Number of attempts', example: 2 })
  attempts!: number;
}