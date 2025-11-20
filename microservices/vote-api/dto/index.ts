import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterVoterDto {
  @IsString()
  @IsNotEmpty()
  voterId: string;

  @IsString()
  @IsNotEmpty()
  ballotId: string;
}

export class CastVoteDto {
  @IsString()
  @IsNotEmpty()
  voterId: string;

  @IsString()
  @IsNotEmpty()
  ballotId: string;

  @IsString()
  @IsNotEmpty()
  candidateId: string;

  @IsString()
  @IsNotEmpty()
  zkProof: string;

  @IsString()
  @IsNotEmpty()
  publicInputs: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
