/**
 * Gym Business Data — Hardcoded PayanarssTypes
 * =============================================
 * Contains the complete TargetCustomer tree structure
 * and Gym Business DB Schema for the "Identify Target
 * Customer Segment" use case.
 *
 * Source: PTS_TargetCustomer_Tree.json (99 nodes)
 * Design: Max 3-4 columns per branch, depth 3
 *
 * TODO: Replace with dynamic fetch from VanakkamPayanarssTypes.json
 *       once the tree structure is merged into the main file.
 */

// ═══════════════════════════════════════════════════════════════
// TYPE IDS — Referenced by PayanarssTypeId
// ═══════════════════════════════════════════════════════════════

export const PTS_TYPE_IDS = {
  TABLE_TYPE: "100000000000000000000000000000001",
  CHILD_TABLE: "100000000000000000000000000000002",
  LOOKUP_TYPE: "100000000000000000000000000000003",
  GROUP_TYPE: "100000000000000000000000000000004",
  ATTRIBUTE_TYPE: "100000000000000000000000000000005",
  TEXT: "100000000000000000000000000000006",
  NUMBER: "100000000000000000000000000000007",
  DATE_TIME: "100000000000000000000000000000008",
  BOOLEAN: "100000000000000000000000000000009",
  BLOB: "100000000000000000000000000000010",
  LOOKUP_VALUE: "1000000000000000000000000000000031",
  BUSINESS_USE_CASE: "10000000000000000000000000000000111",
  BUSINESS_MODULES: "10000000000000000000000000000001111",
};

// ═══════════════════════════════════════════════════════════════
// TYPE DISPLAY CONFIG — Icons, labels, colors per type
// ═══════════════════════════════════════════════════════════════

export const TYPE_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  [PTS_TYPE_IDS.TABLE_TYPE]:      { label: "Table",       icon: "🗃️", color: "#10b981" },
  [PTS_TYPE_IDS.CHILD_TABLE]:     { label: "Branch",      icon: "📂", color: "#8b5cf6" },
  [PTS_TYPE_IDS.LOOKUP_TYPE]:     { label: "Lookup",      icon: "🔗", color: "#ec4899" },
  [PTS_TYPE_IDS.GROUP_TYPE]:      { label: "Group",       icon: "🏢", color: "#a78bfa" },
  [PTS_TYPE_IDS.ATTRIBUTE_TYPE]:  { label: "Rule",        icon: "📏", color: "#ef4444" },
  [PTS_TYPE_IDS.TEXT]:            { label: "Text",        icon: "📝", color: "#6b7280" },
  [PTS_TYPE_IDS.NUMBER]:          { label: "Number",      icon: "#️⃣",  color: "#3b82f6" },
  [PTS_TYPE_IDS.DATE_TIME]:       { label: "DateTime",    icon: "📅", color: "#f59e0b" },
  [PTS_TYPE_IDS.BOOLEAN]:         { label: "Boolean",     icon: "✅", color: "#06b6d4" },
  [PTS_TYPE_IDS.BLOB]:            { label: "File",        icon: "📎", color: "#78716c" },
  [PTS_TYPE_IDS.LOOKUP_VALUE]:    { label: "Value",       icon: "🏷️", color: "#d946ef" },
  [PTS_TYPE_IDS.BUSINESS_USE_CASE]: { label: "Use Case", icon: "⚡", color: "#f59e0b" },
};

// ═══════════════════════════════════════════════════════════════
// TREE NODE — The shape used by the tree view component
// ═══════════════════════════════════════════════════════════════

export interface GymTreeNode {
  id: string;
  parentId: string;
  name: string;
  typeId: string;
  description: string;
  children: GymTreeNode[];
}

// ═══════════════════════════════════════════════════════════════
// TARGET CUSTOMER — Flat PayanarssType array (99 nodes)
// ═══════════════════════════════════════════════════════════════

interface PTSNode {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Description: string;
}

const TARGET_CUSTOMER_FLAT: PTSNode[] = [
  // ROOT
  { Id: "GYMTC000000000000000000000000001", ParentId: "GYM2000000000000000000000000002", Name: "TargetCustomer", PayanarssTypeId: PTS_TYPE_IDS.TABLE_TYPE, Description: "Target customer segment definition for Gym Business" },

  // LEVEL 1: Main branches
  { Id: "GYMTC000000000000000000000000002", ParentId: "GYMTC000000000000000000000000001", Name: "Identity", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Core identification; Code, Name, Status" },
  { Id: "GYMTC000000000000000000000000003", ParentId: "GYMTC000000000000000000000000001", Name: "Audit", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "System tracking; Creation and modification metadata" },
  { Id: "GYMTC000000000000000000000000004", ParentId: "GYMTC000000000000000000000000001", Name: "Demographics", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Who is the target customer; Age, gender, income, fitness" },
  { Id: "GYMTC000000000000000000000000005", ParentId: "GYMTC000000000000000000000000001", Name: "Behavior", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Training preferences and engagement patterns" },
  { Id: "GYMTC000000000000000000000000006", ParentId: "GYMTC000000000000000000000000001", Name: "Financials", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Budget, pricing, and revenue potential" },
  { Id: "GYMTC000000000000000000000000007", ParentId: "GYMTC000000000000000000000000001", Name: "Marketing", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Channels, messaging, and retention" },
  { Id: "GYMTC000000000000000000000000008", ParentId: "GYMTC000000000000000000000000001", Name: "Metrics", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Market size, member counts, conversion" },
  { Id: "GYMTC000000000000000000000000009", ParentId: "GYMTC000000000000000000000000001", Name: "Insights", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Competitor analysis, notes, media" },
  { Id: "GYMTC000000000000000000000000010", ParentId: "GYMTC000000000000000000000000001", Name: "Rules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Validations, calculations, alerts, workflows" },
  { Id: "GYMTC000000000000000000000000011", ParentId: "GYMTC000000000000000000000000001", Name: "LookupValues", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Reference data; All lookup value lists" },

  // IDENTITY
  { Id: "GYMTC000000000000000000000000012", ParentId: "GYMTC000000000000000000000000002", Name: "Code", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Unique TargetCustomer code (STRING)" },
  { Id: "GYMTC000000000000000000000000013", ParentId: "GYMTC000000000000000000000000002", Name: "Name", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Target customer segment name (STRING)" },
  { Id: "GYMTC000000000000000000000000014", ParentId: "GYMTC000000000000000000000000002", Name: "Status", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Active/Inactive/Draft (LOOKUP)" },

  // AUDIT → CreationTrack, ModificationTrack, LifecycleTrack
  { Id: "GYMTC000000000000000000000000015", ParentId: "GYMTC000000000000000000000000003", Name: "CreationTrack", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Who created and when" },
  { Id: "GYMTC000000000000000000000000016", ParentId: "GYMTC000000000000000000000000015", Name: "CreatedBy", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Created by user (STRING)" },
  { Id: "GYMTC000000000000000000000000017", ParentId: "GYMTC000000000000000000000000015", Name: "CreatedOn", PayanarssTypeId: PTS_TYPE_IDS.DATE_TIME, Description: "Creation timestamp (DATETIME)" },
  { Id: "GYMTC000000000000000000000000018", ParentId: "GYMTC000000000000000000000000003", Name: "ModificationTrack", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Who modified and when" },
  { Id: "GYMTC000000000000000000000000019", ParentId: "GYMTC000000000000000000000000018", Name: "ModifiedBy", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Last modified by (STRING)" },
  { Id: "GYMTC000000000000000000000000020", ParentId: "GYMTC000000000000000000000000018", Name: "ModifiedOn", PayanarssTypeId: PTS_TYPE_IDS.DATE_TIME, Description: "Last modification timestamp (DATETIME)" },
  { Id: "GYMTC000000000000000000000000021", ParentId: "GYMTC000000000000000000000000003", Name: "LifecycleTrack", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Soft delete flag" },
  { Id: "GYMTC000000000000000000000000022", ParentId: "GYMTC000000000000000000000000021", Name: "IsActive", PayanarssTypeId: PTS_TYPE_IDS.BOOLEAN, Description: "Soft-delete flag (BOOLEAN)" },

  // DEMOGRAPHICS → SegmentProfile, AgeProfile, FitnessProfile
  { Id: "GYMTC000000000000000000000000023", ParentId: "GYMTC000000000000000000000000004", Name: "SegmentProfile", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Segment classification and income" },
  { Id: "GYMTC000000000000000000000000024", ParentId: "GYMTC000000000000000000000000023", Name: "SegmentType", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Bodybuilders/General Fitness/Women-Only/CrossFit/Senior/Youth/Corporate/Athletes/24-Hour/Boutique (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000025", ParentId: "GYMTC000000000000000000000000023", Name: "IncomeLevel", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Budget/Mid-Range/Premium/Luxury (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000026", ParentId: "GYMTC000000000000000000000000023", Name: "Occupation", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Primary occupation of target segment (STRING)" },

  { Id: "GYMTC000000000000000000000000027", ParentId: "GYMTC000000000000000000000000004", Name: "AgeProfile", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Age targeting; Min and max range" },
  { Id: "GYMTC000000000000000000000000028", ParentId: "GYMTC000000000000000000000000027", Name: "AgeRangeMin", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Minimum target age (INTEGER)" },
  { Id: "GYMTC000000000000000000000000029", ParentId: "GYMTC000000000000000000000000027", Name: "AgeRangeMax", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Maximum target age (INTEGER)" },
  { Id: "GYMTC000000000000000000000000030", ParentId: "GYMTC000000000000000000000000027", Name: "Gender", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Male/Female/All (LOOKUP)" },

  { Id: "GYMTC000000000000000000000000031", ParentId: "GYMTC000000000000000000000000004", Name: "FitnessProfile", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Fitness characteristics" },
  { Id: "GYMTC000000000000000000000000032", ParentId: "GYMTC000000000000000000000000031", Name: "FitnessLevel", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Beginner/Intermediate/Advanced/Professional (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000033", ParentId: "GYMTC000000000000000000000000031", Name: "PrimaryGoal", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Weight Loss/Muscle Gain/General Health/Sports Performance/Rehabilitation/Social (LOOKUP)" },

  // BEHAVIOR → TrainingPreference, EngagementStyle, FacilityPreference
  { Id: "GYMTC000000000000000000000000034", ParentId: "GYMTC000000000000000000000000005", Name: "TrainingPreference", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Time, duration, frequency" },
  { Id: "GYMTC000000000000000000000000035", ParentId: "GYMTC000000000000000000000000034", Name: "PreferredTrainingTime", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Early Morning/Morning/Afternoon/Evening/Late Night/Flexible (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000036", ParentId: "GYMTC000000000000000000000000034", Name: "SessionDurationMinutes", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Average session duration in minutes (INTEGER)" },
  { Id: "GYMTC000000000000000000000000037", ParentId: "GYMTC000000000000000000000000034", Name: "WeeklyFrequency", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Expected visits per week (INTEGER)" },

  { Id: "GYMTC000000000000000000000000038", ParentId: "GYMTC000000000000000000000000005", Name: "EngagementStyle", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Group vs individual preferences" },
  { Id: "GYMTC000000000000000000000000039", ParentId: "GYMTC000000000000000000000000038", Name: "GroupClassPreference", PayanarssTypeId: PTS_TYPE_IDS.BOOLEAN, Description: "Prefers group classes (BOOLEAN)" },
  { Id: "GYMTC000000000000000000000000040", ParentId: "GYMTC000000000000000000000000038", Name: "PersonalTrainerRequired", PayanarssTypeId: PTS_TYPE_IDS.BOOLEAN, Description: "Requires personal trainer (BOOLEAN)" },

  { Id: "GYMTC000000000000000000000000041", ParentId: "GYMTC000000000000000000000000005", Name: "FacilityPreference", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Equipment and amenity needs" },
  { Id: "GYMTC000000000000000000000000042", ParentId: "GYMTC000000000000000000000000041", Name: "EquipmentFocus", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Free Weights/Machines/Cardio/Functional/Mixed (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000043", ParentId: "GYMTC000000000000000000000000041", Name: "FacilityRequirements", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Specific facility needs (STRING)" },
  { Id: "GYMTC000000000000000000000000044", ParentId: "GYMTC000000000000000000000000041", Name: "SpecialAmenities", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Sauna, pool, cafe, childcare (STRING)" },

  // FINANCIALS → BudgetProfile, RevenueProfile
  { Id: "GYMTC000000000000000000000000045", ParentId: "GYMTC000000000000000000000000006", Name: "BudgetProfile", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Price sensitivity and budget range" },
  { Id: "GYMTC000000000000000000000000046", ParentId: "GYMTC000000000000000000000000045", Name: "PriceSensitivity", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Low/Medium/High (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000047", ParentId: "GYMTC000000000000000000000000045", Name: "MonthlyBudgetMin", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Min monthly willingness to pay (DECIMAL)" },
  { Id: "GYMTC000000000000000000000000048", ParentId: "GYMTC000000000000000000000000045", Name: "MonthlyBudgetMax", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Max monthly willingness to pay (DECIMAL)" },

  { Id: "GYMTC000000000000000000000000049", ParentId: "GYMTC000000000000000000000000006", Name: "RevenueProfile", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Plan preference and upsell opportunity" },
  { Id: "GYMTC000000000000000000000000050", ParentId: "GYMTC000000000000000000000000049", Name: "PreferredPlanType", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Monthly/Quarterly/Annual/Pay-Per-Visit/Class-Pack (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000051", ParentId: "GYMTC000000000000000000000000049", Name: "UpsellPotential", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Low/Medium/High (LOOKUP)" },

  // MARKETING → Acquisition, Retention
  { Id: "GYMTC000000000000000000000000052", ParentId: "GYMTC000000000000000000000000007", Name: "Acquisition", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Channel and message strategy" },
  { Id: "GYMTC000000000000000000000000053", ParentId: "GYMTC000000000000000000000000052", Name: "MarketingChannel", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Social Media/Google Ads/Referral/Corporate Partnership/Local Flyers/Influencer (LOOKUP)" },
  { Id: "GYMTC000000000000000000000000054", ParentId: "GYMTC000000000000000000000000052", Name: "MarketingMessage", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Key marketing message (STRING)" },

  { Id: "GYMTC000000000000000000000000055", ParentId: "GYMTC000000000000000000000000007", Name: "Retention", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Retention and churn monitoring" },
  { Id: "GYMTC000000000000000000000000056", ParentId: "GYMTC000000000000000000000000055", Name: "RetentionStrategy", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Retention approach (STRING)" },
  { Id: "GYMTC000000000000000000000000057", ParentId: "GYMTC000000000000000000000000055", Name: "ChurnRiskLevel", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_TYPE, Description: "Low/Medium/High (LOOKUP)" },

  // METRICS → MarketSizing, Performance
  { Id: "GYMTC000000000000000000000000058", ParentId: "GYMTC000000000000000000000000008", Name: "MarketSizing", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Total addressable and current penetration" },
  { Id: "GYMTC000000000000000000000000059", ParentId: "GYMTC000000000000000000000000058", Name: "EstimatedMarketSize", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Potential customers in area (INTEGER)" },
  { Id: "GYMTC000000000000000000000000060", ParentId: "GYMTC000000000000000000000000058", Name: "CurrentMemberCount", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Current members in segment (INTEGER)" },
  { Id: "GYMTC000000000000000000000000061", ParentId: "GYMTC000000000000000000000000058", Name: "TargetMemberCount", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Target members to acquire (INTEGER)" },

  { Id: "GYMTC000000000000000000000000062", ParentId: "GYMTC000000000000000000000000008", Name: "Performance", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Conversion and lifetime metrics" },
  { Id: "GYMTC000000000000000000000000063", ParentId: "GYMTC000000000000000000000000062", Name: "ConversionRate", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Lead-to-member conversion rate % (DECIMAL)" },
  { Id: "GYMTC000000000000000000000000064", ParentId: "GYMTC000000000000000000000000062", Name: "AverageLifetimeMonths", PayanarssTypeId: PTS_TYPE_IDS.NUMBER, Description: "Average membership duration (DECIMAL)" },

  // INSIGHTS
  { Id: "GYMTC000000000000000000000000065", ParentId: "GYMTC000000000000000000000000009", Name: "CompetitorAnalysis", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "How competitors serve this segment (STRING)" },
  { Id: "GYMTC000000000000000000000000066", ParentId: "GYMTC000000000000000000000000009", Name: "Notes", PayanarssTypeId: PTS_TYPE_IDS.TEXT, Description: "Additional notes (STRING)" },
  { Id: "GYMTC000000000000000000000000067", ParentId: "GYMTC000000000000000000000000009", Name: "Photo", PayanarssTypeId: PTS_TYPE_IDS.BLOB, Description: "Segment image or marketing material (FILE)" },

  // RULES → AutoGeneration, Required, Validation, Calculation, Alert, Workflow
  { Id: "GYMTC000000000000000000000000068", ParentId: "GYMTC000000000000000000000000010", Name: "AutoGenerationRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Auto code and uniqueness" },
  { Id: "GYMTC000000000000000000000000069", ParentId: "GYMTC000000000000000000000000068", Name: "AUTO-NUMBER: Code in TCS-YYYYMMDD-NNNN", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Auto-number rule" },
  { Id: "GYMTC000000000000000000000000070", ParentId: "GYMTC000000000000000000000000068", Name: "UNIQUE: Code must be unique", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Uniqueness constraint" },

  { Id: "GYMTC000000000000000000000000071", ParentId: "GYMTC000000000000000000000000010", Name: "RequiredFieldRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Mandatory fields" },
  { Id: "GYMTC000000000000000000000000072", ParentId: "GYMTC000000000000000000000000071", Name: "REQUIRED: Name is mandatory", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Required field" },
  { Id: "GYMTC000000000000000000000000073", ParentId: "GYMTC000000000000000000000000071", Name: "REQUIRED: SegmentType is mandatory", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Required field" },
  { Id: "GYMTC000000000000000000000000074", ParentId: "GYMTC000000000000000000000000071", Name: "REQUIRED: PrimaryGoal is mandatory", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Required field" },

  { Id: "GYMTC000000000000000000000000075", ParentId: "GYMTC000000000000000000000000010", Name: "ValidationRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Range and boundary checks" },
  { Id: "GYMTC000000000000000000000000076", ParentId: "GYMTC000000000000000000000000075", Name: "VALIDATION: AgeRangeMax > AgeRangeMin", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Age range validation" },
  { Id: "GYMTC000000000000000000000000077", ParentId: "GYMTC000000000000000000000000075", Name: "VALIDATION: BudgetMax >= BudgetMin", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Budget range validation" },
  { Id: "GYMTC000000000000000000000000078", ParentId: "GYMTC000000000000000000000000075", Name: "VALIDATION: ConversionRate 0-100", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Rate range validation" },

  { Id: "GYMTC000000000000000000000000079", ParentId: "GYMTC000000000000000000000000010", Name: "CalculationRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Auto-computed derived values" },
  { Id: "GYMTC000000000000000000000000080", ParentId: "GYMTC000000000000000000000000079", Name: "CALC: MarketPenetration = (Current / Market) * 100", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Market penetration %" },
  { Id: "GYMTC000000000000000000000000081", ParentId: "GYMTC000000000000000000000000079", Name: "CALC: GrowthGap = Target - Current", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Members to acquire" },
  { Id: "GYMTC000000000000000000000000082", ParentId: "GYMTC000000000000000000000000079", Name: "CALC: MonthlyRevenue = Current * BudgetMin", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Estimated revenue" },
  { Id: "GYMTC000000000000000000000000083", ParentId: "GYMTC000000000000000000000000079", Name: "CALC: LifetimeValue = Lifetime * BudgetMin", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Customer LTV" },

  { Id: "GYMTC000000000000000000000000084", ParentId: "GYMTC000000000000000000000000010", Name: "AlertRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Notification triggers" },
  { Id: "GYMTC000000000000000000000000085", ParentId: "GYMTC000000000000000000000000084", Name: "ALERT: Current exceeds Target", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Target achievement alert" },
  { Id: "GYMTC000000000000000000000000086", ParentId: "GYMTC000000000000000000000000084", Name: "ALERT: ChurnRisk is High", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "High churn risk alert" },

  { Id: "GYMTC000000000000000000000000087", ParentId: "GYMTC000000000000000000000000010", Name: "WorkflowRules", PayanarssTypeId: PTS_TYPE_IDS.CHILD_TABLE, Description: "Status transition constraints" },
  { Id: "GYMTC000000000000000000000000088", ParentId: "GYMTC000000000000000000000000087", Name: "WORKFLOW: Draft→Active→Inactive", PayanarssTypeId: PTS_TYPE_IDS.ATTRIBUTE_TYPE, Description: "Status workflow" },

  // LOOKUP VALUES
  { Id: "GYMTC000000000000000000000000089", ParentId: "GYMTC000000000000000000000000011", Name: "SegmentTypeLookupValues", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Lookup values for SegmentType" },
  { Id: "GYMTC000000000000000000000000090", ParentId: "GYMTC000000000000000000000000089", Name: "Bodybuilders", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Muscle mass and strength focused" },
  { Id: "GYMTC000000000000000000000000091", ParentId: "GYMTC000000000000000000000000089", Name: "General Fitness", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Overall fitness and wellness" },
  { Id: "GYMTC000000000000000000000000092", ParentId: "GYMTC000000000000000000000000089", Name: "Women-Only", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Women-exclusive environment" },
  { Id: "GYMTC000000000000000000000000093", ParentId: "GYMTC000000000000000000000000089", Name: "CrossFit / Functional Training", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "High-intensity functional fitness" },
  { Id: "GYMTC000000000000000000000000094", ParentId: "GYMTC000000000000000000000000089", Name: "Senior / Rehabilitation", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Older adults and recovery" },
  { Id: "GYMTC000000000000000000000000095", ParentId: "GYMTC000000000000000000000000089", Name: "Youth / Teen Fitness", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Age 13-18 programs" },
  { Id: "GYMTC000000000000000000000000096", ParentId: "GYMTC000000000000000000000000089", Name: "Corporate / Office Workers", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Working professionals" },
  { Id: "GYMTC000000000000000000000000097", ParentId: "GYMTC000000000000000000000000089", Name: "Athletes / Sports Training", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Sport-specific training" },
  { Id: "GYMTC000000000000000000000000098", ParentId: "GYMTC000000000000000000000000089", Name: "24-Hour / Budget", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Flexible access, cost-conscious" },
  { Id: "GYMTC000000000000000000000000099", ParentId: "GYMTC000000000000000000000000089", Name: "Boutique / Luxury", PayanarssTypeId: PTS_TYPE_IDS.LOOKUP_VALUE, Description: "Premium experience" },
];

// ═══════════════════════════════════════════════════════════════
// TREE BUILDER — Convert flat array to nested tree
// ═══════════════════════════════════════════════════════════════

function buildTree(flat: PTSNode[], rootId: string): GymTreeNode | null {
  const byId = new Map(flat.map((n) => [n.Id, n]));
  const childrenMap = new Map<string, PTSNode[]>();

  for (const n of flat) {
    if (n.Id !== rootId && n.ParentId !== n.Id) {
      const siblings = childrenMap.get(n.ParentId) || [];
      siblings.push(n);
      childrenMap.set(n.ParentId, siblings);
    }
  }

  function toTree(node: PTSNode): GymTreeNode {
    const children = (childrenMap.get(node.Id) || []).map(toTree);
    return {
      id: node.Id,
      parentId: node.ParentId,
      name: node.Name,
      typeId: node.PayanarssTypeId,
      description: node.Description,
      children,
    };
  }

  const root = byId.get(rootId);
  return root ? toTree(root) : null;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — What other components import
// ═══════════════════════════════════════════════════════════════

/** Get the complete TargetCustomer tree (99 nodes, depth 3) */
export function getTargetCustomerTree(): GymTreeNode | null {
  return buildTree(TARGET_CUSTOMER_FLAT, "GYMTC000000000000000000000000001");
}

/** Get all flat PayanarssType nodes for TargetCustomer */
export function getTargetCustomerFlat(): PTSNode[] {
  return TARGET_CUSTOMER_FLAT;
}

/** Get node count */
export function getTargetCustomerNodeCount(): number {
  return TARGET_CUSTOMER_FLAT.length;
}

/** Count all nodes in a tree */
export function countTreeNodes(node: GymTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countTreeNodes(child);
  }
  return count;
}
