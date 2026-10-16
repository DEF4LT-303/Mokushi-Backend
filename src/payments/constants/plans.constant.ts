import { PlanType } from "@prisma/client";

export interface PlanConfig {
  planType: PlanType;
  title: string;
  description: string;
  price: number; // in BDT
  currency: string;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  [PlanType.N5_BUNDLE]: {
    planType: PlanType.N5_BUNDLE,
    title: "JLPT N5 Bundle",
    description:
      "Unlock all JLPT N5 modules, lessons, and quizzes permanently.",
    price: 499,
    currency: "BDT",
    features: [
      "Access all 25+ N5 Grammar and Vocab Modules",
      "Unlimited N5 Quizzes and Tests",
      "Grammar rule explanations and examples",
      "Lifetime access",
    ],
  },
  [PlanType.N4_BUNDLE]: {
    planType: PlanType.N4_BUNDLE,
    title: "JLPT N4 Bundle",
    description:
      "Unlock all JLPT N4 modules, lessons, and quizzes permanently.",
    price: 699,
    currency: "BDT",
    features: [
      "Access all JLPT N4 intermediate modules",
      "Unlimited N4 Quizzes and Practice",
      "Comprehensive grammar and sentence structures",
      "Lifetime access",
    ],
  },
  [PlanType.RAPID_FIRE_BUNDLE]: {
    planType: PlanType.RAPID_FIRE_BUNDLE,
    title: "Unlimited Rapid-Fire",
    description:
      "Remove daily drill limits for rapid-fire vocabulary training.",
    price: 299,
    currency: "BDT",
    features: [
      "Unlimited daily Rapid-Fire sessions",
      "Master vocabulary and Kanji under time pressure",
      "Hard words tracking and bookmarking",
      "Lifetime access",
    ],
  },
  [PlanType.FULL_ACCESS_BUNDLE]: {
    planType: PlanType.FULL_ACCESS_BUNDLE,
    title: "All-in-One Full Access",
    description:
      "Unlock everything: all JLPT modules, quizzes, and unlimited rapid fire.",
    price: 999,
    currency: "BDT",
    features: [
      "Complete JLPT N5 & N4 Modules",
      "All quizzes, grammar rules, and exercises",
      "Unlimited Rapid-Fire drills",
      "Priority future content updates",
      "Lifetime access",
    ],
  },
};
