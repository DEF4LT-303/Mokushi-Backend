import { PlanCategory, PlanType } from "@prisma/client";

export interface PlanConfig {
  planType: PlanType;
  category: PlanCategory;
  title: string;
  description: string;
  price: number; // in BDT
  currency: string;
  features: string[];
  isActive: boolean;
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  [PlanType.N5]: {
    planType: PlanType.N5,
    category: PlanCategory.CORE_MODULE,
    title: "JLPT N5",
    description:
      "Unlock all premium JLPT N5 modules, lessons, and quizzes permanently.",
    price: 499,
    currency: "BDT",
    features: [
      "Access all premium N5 Grammar and Vocab Modules",
      "Unlimited N5 Quizzes and Tests",
      "Grammar rule explanations and examples",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.N4]: {
    planType: PlanType.N4,
    category: PlanCategory.CORE_MODULE,
    title: "JLPT N4",
    description:
      "Unlock all premium JLPT N4 modules, lessons, and quizzes permanently.",
    price: 699,
    currency: "BDT",
    features: [
      "Access all premium JLPT N4 intermediate modules",
      "Unlimited N4 Quizzes and Practice",
      "Comprehensive grammar and sentence structures",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.RAPID_FIRE_N5]: {
    planType: PlanType.RAPID_FIRE_N5,
    category: PlanCategory.RAPID_FIRE,
    title: "Rapid Fire N5",
    description:
      "Unlock all premium JLPT N5 rapid-fire vocabulary drill lessons permanently.",
    price: 299,
    currency: "BDT",
    features: [
      "Access all premium N5 Rapid-Fire vocabulary drills",
      "Master N5 vocabulary under time pressure",
      "Hard words tracking and bookmarking",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.RAPID_FIRE_N4]: {
    planType: PlanType.RAPID_FIRE_N4,
    category: PlanCategory.RAPID_FIRE,
    title: "Rapid Fire N4",
    description:
      "Unlock all premium JLPT N4 rapid-fire vocabulary drill lessons permanently.",
    price: 399,
    currency: "BDT",
    features: [
      "Access all premium N4 Rapid-Fire vocabulary drills",
      "Master N4 vocabulary under time pressure",
      "Hard words tracking and bookmarking",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.N5_N4_BUNDLE]: {
    planType: PlanType.N5_N4_BUNDLE,
    category: PlanCategory.BUNDLE,
    title: "JLPT N5 + N4 Bundle",
    description:
      "Unlock all premium JLPT N5 and N4 modules, lessons, and quizzes (without rapid-fire).",
    price: 999,
    currency: "BDT",
    features: [
      "All premium JLPT N5 modules, lessons, and quizzes",
      "All premium JLPT N4 modules, lessons, and quizzes",
      "Comprehensive grammar rules and practice tests",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.N5_RAPID_FIRE_BUNDLE]: {
    planType: PlanType.N5_RAPID_FIRE_BUNDLE,
    category: PlanCategory.BUNDLE,
    title: "JLPT N5 + Rapid Fire Bundle",
    description:
      "Unlock all premium JLPT N5 modules, quizzes, and JLPT N5 rapid-fire drills.",
    price: 699,
    currency: "BDT",
    features: [
      "All premium JLPT N5 modules and quizzes",
      "All premium JLPT N5 Rapid-Fire vocabulary drills",
      "Grammar rules, practice tests, and speed drills",
      "Lifetime access",
    ],
    isActive: true,
  },
  [PlanType.N4_RAPID_FIRE_BUNDLE]: {
    planType: PlanType.N4_RAPID_FIRE_BUNDLE,
    category: PlanCategory.BUNDLE,
    title: "JLPT N4 + Rapid Fire Bundle",
    description:
      "Unlock all premium JLPT N4 modules, quizzes, and JLPT N4 rapid-fire drills.",
    price: 899,
    currency: "BDT",
    features: [
      "All premium JLPT N4 modules and quizzes",
      "All premium JLPT N4 Rapid-Fire vocabulary drills",
      "Comprehensive N4 grammar, quizzes, and speed drills",
      "Lifetime access",
    ],
    isActive: true,
  },
};
