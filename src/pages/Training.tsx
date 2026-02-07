import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Search,
  Play,
  Clock,
  Award,
  BookOpen,
  Video,
  FileText,
} from "lucide-react";

const courses = [
  {
    id: 1,
    title: "Destination Specialist: Caribbean",
    description:
      "Master the Caribbean region, from island hopping to luxury resorts.",
    category: "Destinations",
    duration: "4 hours",
    lessons: 12,
    progress: 75,
    image: "🏝️",
    badge: "Bronze",
    status: "in-progress",
  },
  {
    id: 2,
    title: "Luxury Cruise Certification",
    description:
      "Everything you need to know about selling luxury cruise experiences.",
    category: "Cruises",
    duration: "3 hours",
    lessons: 8,
    progress: 40,
    image: "🚢",
    badge: null,
    status: "in-progress",
  },
  {
    id: 3,
    title: "Corporate Travel Fundamentals",
    description:
      "Learn the essentials of managing corporate travel accounts.",
    category: "Business Travel",
    duration: "2 hours",
    lessons: 6,
    progress: 100,
    image: "💼",
    badge: "Gold",
    status: "completed",
  },
  {
    id: 4,
    title: "European Rail Adventures",
    description: "Become an expert in European rail travel and itineraries.",
    category: "Destinations",
    duration: "3.5 hours",
    lessons: 10,
    progress: 0,
    image: "🚄",
    badge: null,
    status: "new",
  },
  {
    id: 5,
    title: "Adventure & Eco-Tourism",
    description:
      "Sustainable travel and adventure tourism best practices.",
    category: "Specialty",
    duration: "2.5 hours",
    lessons: 7,
    progress: 0,
    image: "🌿",
    badge: null,
    status: "new",
  },
  {
    id: 6,
    title: "Wedding & Honeymoon Specialist",
    description:
      "Create unforgettable wedding travel experiences for couples.",
    category: "Specialty",
    duration: "3 hours",
    lessons: 9,
    progress: 100,
    image: "💒",
    badge: "Silver",
    status: "completed",
  },
];

const Training = () => {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Training Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Expand your expertise and earn certifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Award className="h-5 w-5" />
            <span className="font-semibold">3 Badges Earned</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-card-foreground">12</p>
            <p className="text-sm text-muted-foreground">Courses Available</p>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
            <Award className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-card-foreground">2</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-card-foreground">2</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-card-foreground">18h</p>
            <p className="text-sm text-muted-foreground">Total Learning</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search courses..." className="pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              All
            </Button>
            <Button variant="ghost" size="sm">
              In Progress
            </Button>
            <Button variant="ghost" size="sm">
              Completed
            </Button>
            <Button variant="ghost" size="sm">
              New
            </Button>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="h-32 bg-gradient-ocean flex items-center justify-center">
              <span className="text-5xl">{course.image}</span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="secondary" className="text-xs">
                  {course.category}
                </Badge>
                {course.badge && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      course.badge === "Gold"
                        ? "bg-amber-100 text-amber-700"
                        : course.badge === "Silver"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {course.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-card-foreground mb-2">
                {course.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {course.description}
              </p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {course.lessons} lessons
                </span>
              </div>

              {course.progress > 0 && course.progress < 100 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-card-foreground">
                      {course.progress}%
                    </span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>
              )}

              <Button
                className="w-full gap-2"
                variant={course.progress === 100 ? "outline" : "default"}
              >
                {course.progress === 0 ? (
                  <>
                    <Play className="h-4 w-4" />
                    Start Course
                  </>
                ) : course.progress === 100 ? (
                  <>
                    <Award className="h-4 w-4" />
                    View Certificate
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Training;
