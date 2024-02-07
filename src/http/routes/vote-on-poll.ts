import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { z } from "zod";

const COOKIE_MAX_AGE_IN_DAYS = 30;
const COOKIE_MAX_AGE_IN_SECONDS = COOKIE_MAX_AGE_IN_DAYS * 24 * 60 * 60;

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", async (request, reply) => {
    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid(),
    });

    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const { pollId } = voteOnPollParams.parse(request.params);

    let { sessionId } = request.cookies;

    if (sessionId) {
      const userPreviousVoteOnPoll = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            sessionId,
            pollId,
          },
        },
      });

      if (
        userPreviousVoteOnPoll &&
        userPreviousVoteOnPoll.pollOptionId === pollOptionId
      ) {
        return reply
          .status(400)
          .send({ message: "You already voted on this poll." });
      }

      if (userPreviousVoteOnPoll) {
        await prisma.vote.delete({
          where: {
            id: userPreviousVoteOnPoll.id,
          },
        });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();

      reply.setCookie("sessionId", sessionId, {
        path: "/",
        maxAge: COOKIE_MAX_AGE_IN_SECONDS, // 30 days
        signed: true,
        httpOnly: true,
      });
    }

    await prisma.vote.create({
      data: {
        sessionId,
        pollId,
        pollOptionId,
      },
    });

    return reply.status(201).send();
  });
}
