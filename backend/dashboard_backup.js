import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function CareerDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraperProgress, setScraperProgress] = useState(45); // Mock progress

  useEffect(() => {
    // Fetch jobs from DRF API
    // fetch('/api/jobs/').then(...)
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Career Agent
          </h1>
          <p className="text-slate-400">Premium Job Matching for Kenyan Django Developers</p>
        </div>
        <div className="w-64">
          <div className="flex justify-between text-xs mb-1">
            <span>Scraper Status</span>
            <span>{scraperProgress}%</span>
          </div>
          <Progress value={scraperProgress} className="h-2 bg-slate-800" />
        </div>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Top Picks (80%+ Match)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Job Card Example */}
          <Card className="bg-slate-900 border-slate-800 hover:border-blue-500 transition-all cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">92% Match</Badge>
                <span className="text-slate-500 text-xs">2 hours ago</span>
              </div>
              <CardTitle className="text-xl mt-2 text-slate-100">Senior Django Backend Developer</CardTitle>
              <p className="text-slate-400">TechSolutions Inc. • Remote (Global)</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="border-slate-700 text-slate-300">Django</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">PostgreSQL</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">Next.js</Badge>
              </div>
              <p className="text-sm text-slate-400 line-clamp-3 mb-4">
                We are looking for a Kenyan-based developer to join our global engineering team...
              </p>
              <div className="flex justify-between items-center">
                <span className="text-blue-400 font-medium">$3,000 - $5,000 / mo</span>
                <Button variant="secondary" className="bg-blue-600 hover:bg-blue-500 text-white border-0">
                  Apply with AI
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Latest Jobs</h2>
          <div className="flex gap-2">
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800">Local (Kenya)</Button>
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800">International Remote</Button>
          </div>
        </div>
        {/* Full list of jobs */}
      </section>
    </div>
  );
}
