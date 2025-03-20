'use server';

import { currentUser } from "@clerk/nextjs/server";

export async function getCurrentUser() {
  try {
    const user = await currentUser();
    if (!user) return null;

    return {
      id: user.id,
      firstName: user.firstName,
      emailAddress: user.emailAddresses[0]?.emailAddress,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}