import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Star, Target, Flame, Award, Crown, Medal,
  Footprints, ListChecks, CheckCircle, Inbox, Car, MapPin,
  Zap, Settings, Coins, Banknote, PiggyBank, TrendingUp,
  ListTodo, Sparkles, TrendingDown, FileText, Route, Lock
} from "lucide-react";
import { useEffect } from "react";

const iconMap: Record<string, any> = {
  Trophy, Star, Target, Flame, Award, Crown, Medal,
  Footprints, ListChecks, CheckCircle, Inbox, Car, MapPin,
  Zap, Settings, Coins, Banknote, PiggyBank, TrendingUp, Fire: Flame,
  ListTodo, Sparkles, TrendingDown, FileText, Route, Lock
};

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
  threshold: number | null;
  unlocked: boolean;
  unlockedAt?: string;
}

interface Challenge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  challengeType: string;
  targetValue: number;
  metricType: string;
  currentValue: number;
  isCompleted: boolean;
  started: boolean;
}

interface UserStats {
  id: string;
  totalPoints: number;
  level: number;
  streak: number;
  lastActivityDate: string | null;
  achievementsUnlocked: number;
  challengesCompleted: number;
  pointsToNextLevel: number;
}

export default function Gamification() {
  const queryClient = useQueryClient();

  const { data: achievements = [], isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ['/api/gamification/achievements'],
  });

  const { data: challenges = [], isLoading: challengesLoading } = useQuery<Challenge[]>({
    queryKey: ['/api/gamification/challenges'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/gamification/stats'],
  });

  const checkAchievements = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gamification/check-achievements', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/achievements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/stats'] });
    }
  });

  useEffect(() => {
    checkAchievements.mutate();
  }, []);

  const getIcon = (iconName: string, className: string = "h-6 w-6") => {
    const IconComponent = iconMap[iconName] || Trophy;
    return <IconComponent className={className} />;
  };

  const categoryColors: Record<string, string> = {
    tracking: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    budgeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    savings: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    milestones: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };

  const challengeTypeColors: Record<string, string> = {
    weekly: "bg-blue-500",
    monthly: "bg-purple-500",
    "one-time": "bg-amber-500",
  };

  const groupedAchievements = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalAchievements = achievements.length;

  if (statsLoading || achievementsLoading || challengesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Rewards & Challenges</h1>
          <p className="text-muted-foreground">Track your progress and earn rewards for financial discipline</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => checkAchievements.mutate()}
          disabled={checkAchievements.isPending}
          data-testid="btn-check-achievements"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Check Progress
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-600" />
              Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400" data-testid="text-user-level">
              {stats?.level || 1}
            </div>
            <Progress 
              value={stats ? ((stats.level * 100 - stats.pointsToNextLevel) / (stats.level * 100)) * 100 : 0} 
              className="h-2 mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pointsToNextLevel || 100} points to next level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Total Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-points">
              {stats?.totalPoints?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-green-600" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-achievements-count">
              {unlockedCount} / {totalAchievements}
            </div>
            <Progress value={(unlockedCount / totalAchievements) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-streak">
              {stats?.streak || 0} days
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="achievements" className="w-full">
        <TabsList data-testid="tabs-gamification">
          <TabsTrigger value="achievements" data-testid="tab-achievements">
            <Trophy className="h-4 w-4 mr-2" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">
            <Target className="h-4 w-4 mr-2" />
            Challenges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="mt-6 space-y-6">
          {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                  {category === 'tracking' && <ListChecks className="h-5 w-5 text-blue-600" />}
                  {category === 'budgeting' && <PiggyBank className="h-5 w-5 text-purple-600" />}
                  {category === 'savings' && <Coins className="h-5 w-5 text-green-600" />}
                  {category === 'milestones' && <Award className="h-5 w-5 text-amber-600" />}
                  {category}
                </CardTitle>
                <CardDescription>
                  {categoryAchievements.filter(a => a.unlocked).length} of {categoryAchievements.length} unlocked
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryAchievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border transition-all ${
                        achievement.unlocked 
                          ? 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950 dark:to-yellow-900 border-amber-300 dark:border-amber-700' 
                          : 'bg-muted/50 border-muted opacity-60'
                      }`}
                      data-testid={`achievement-${achievement.code}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          achievement.unlocked 
                            ? 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {achievement.unlocked ? getIcon(achievement.icon) : <Lock className="h-6 w-6" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{achievement.name}</h4>
                            <Badge variant="secondary" className={categoryColors[category]}>
                              +{achievement.points}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {achievement.description}
                          </p>
                          {achievement.unlocked && achievement.unlockedAt && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="challenges" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Challenges</CardTitle>
              <CardDescription>Complete challenges to earn bonus points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`p-4 rounded-lg border ${
                      challenge.isCompleted 
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                        : 'bg-card'
                    }`}
                    data-testid={`challenge-${challenge.code}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${
                        challenge.isCompleted 
                          ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300' 
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {getIcon(challenge.icon, "h-6 w-6")}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{challenge.name}</h4>
                            <Badge 
                              variant="outline" 
                              className={challengeTypeColors[challenge.challengeType] + " text-white border-0"}
                            >
                              {challenge.challengeType}
                            </Badge>
                          </div>
                          <Badge variant="secondary">
                            +{challenge.points} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {challenge.description}
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span className="font-medium">
                              {challenge.currentValue} / {challenge.targetValue}
                            </span>
                          </div>
                          <Progress 
                            value={Math.min((challenge.currentValue / challenge.targetValue) * 100, 100)} 
                            className="h-2"
                          />
                        </div>
                        {challenge.isCompleted && (
                          <div className="flex items-center gap-2 mt-3 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Completed!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {challenges.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active challenges available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
