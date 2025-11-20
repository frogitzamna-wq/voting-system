import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyVoteDto {
  @IsString()
  @IsNotEmpty()
  voteId: string;

  @IsString()
  @IsNotEmpty()
  zkProof: string;

  @IsString()
  @IsNotEmpty()
  publicInputs: string;

  @IsString()
  @IsNotEmpty()
  nullifier: string;
}
