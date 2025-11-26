import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';
import { voteApi } from '../api/voteApi';
import { useVoterStore } from '../store/voterStore';

const registrationSchema = z.object({
  voterId: z.string().min(5, 'Voter ID must be at least 5 characters'),
  ballotId: z.string().min(1, 'Please select a ballot'),
  email: z.string().email('Invalid email address').optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export function RegistrationPage() {
  const navigate = useNavigate();
  const setVoter = useVoterStore(state => state.setVoter);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
  });

  const registerMutation = useMutation({
    mutationFn: voteApi.registerVoter,
    onSuccess: (data, variables) => {
      setVoter({
        voterId: variables.voterId,
        ballotId: variables.ballotId,
        commitment: data.commitment,
        registered: true,
      });
      navigate('/vote');
    },
  });

  const onSubmit = (data: RegistrationForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Voter Registration</h1>
      </div>

      <p className="text-gray-600 mb-6">
        Register to participate in the election. Your identity will be verified using
        zero-knowledge proofs to ensure privacy.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="voterId" className="block text-sm font-medium text-gray-700">
            Voter ID
          </label>
          <input
            {...register('voterId')}
            type="text"
            id="voterId"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter your voter ID"
          />
          {errors.voterId && (
            <p className="mt-1 text-sm text-red-600">{errors.voterId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="ballotId" className="block text-sm font-medium text-gray-700">
            Election
          </label>
          <select
            {...register('ballotId')}
            id="ballotId"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select an election</option>
            <option value="ballot-2025-01">2025 General Election</option>
            <option value="ballot-2025-02">Municipal Referendum</option>
          </select>
          {errors.ballotId && (
            <p className="mt-1 text-sm text-red-600">{errors.ballotId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email (Optional)
          </label>
          <input
            {...register('email')}
            type="email"
            id="email"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Register to Vote
            </>
          )}
        </button>

        {registerMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              {registerMutation.error instanceof Error
                ? registerMutation.error.message
                : 'Registration failed. Please try again.'}
            </p>
          </div>
        )}

        {registerMutation.isSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              Registration successful! Redirecting to voting page...
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
