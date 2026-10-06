#!/usr/bin/env node
/**
 * Standalone Node.js Builder for MPOnline Hackathon 2026 Evaluation Dashboard
 * 
 * Zero external dependencies (uses standard Node.js libraries 'fs' and 'path').
 * Reads all evaluation files in evaluations/ (scores.json, evaluation.md, .work/T-(id)/pitch.txt),
 * calculates exact scores and rankings conforming to official hackathon rubric,
 * and writes:
 *   - evaluations_dashboard.html (standalone, offline-ready)
 *   - index.html (root entrypoint for web serving)
 *   - evaluations_data.json
 *   - evaluations_data.js
 * 
 * Usage:
 *   node build_dashboard.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const EVAL_DIR = path.join(ROOT_DIR, 'evaluations');
const WORK_DIR = path.join(EVAL_DIR, '.work');

// Rubric definitions
const TECH_CRITERIA = {
  T1: { name: 'Innovation & Originality', weight: 20, group: 'pres', desc: 'Uniqueness, creativity and originality of the proposed solution.' },
  T2: { name: 'Problem Understanding', weight: 20, group: 'pres', desc: 'Clarity of problem identified, relevance, target users understanding.' },
  T3: { name: 'Technical Feasibility', weight: 10, group: 'tech', desc: 'Practicality of tech, architecture, implementation approach.' },
  T4: { name: 'Prototype / MVP', weight: 10, group: 'tech', desc: 'Functionality, completeness, usability and effectiveness of working prototype.' },
  T5: { name: 'Impact on Higher Ed / Governance', weight: 15, group: 'pres', desc: 'Potential to create meaningful improvements in higher ed / governance.' },
  T6: { name: 'Scalability & Sustainability', weight: 10, group: 'pres', desc: 'Potential for wider adoption, scalability, long-term sustainability.' },
  T7: { name: 'Presentation & Demo', weight: 15, group: 'pres', desc: 'Clarity of communication, quality of demo, storytelling and pitch.' }
};

const NON_TECH_CRITERIA = {
  NT1: { name: 'Problem Understanding', weight: 10, desc: 'Clarity of the problem identified and relevance to stakeholders.' },
  NT2: { name: 'Innovation & Creativity', weight: 15, desc: 'Originality, creativity and uniqueness in addressing the challenge.' },
  NT3: { name: 'Solution Quality', weight: 15, desc: 'Relevance, effectiveness and completeness of proposed solution.' },
  NT4: { name: 'Technical Implementation', weight: 5, desc: 'Quality and practicality of the implementation approach.' },
  NT5: { name: 'UI/UX Design', weight: 5, desc: 'Usability, accessibility, visual clarity and user experience.' },
  NT6: { name: 'Feasibility & Scalability', weight: 10, desc: 'Practicality of implementation and potential for scaling.' },
  NT7: { name: 'Impact / Value', weight: 20, desc: 'Potential value, social or institutional impact.' },
  NT8: { name: 'Presentation & Demo', weight: 20, desc: 'Clarity of communication, quality of demonstration and pitch.' }
};

const THEME_NAMES = {
  1: 'AI & Employability',
  2: 'Digital Campus',
  3: 'AI & Assessment',
  4: 'Digital Inclusion',
  5: 'Public Services',
  6: 'Online Assessment',
  7: 'AI & Employability (Non-Tech)',
  8: 'Digital Campus (Non-Tech)',
  9: 'AI & Assessment (Non-Tech)',
  10: 'Digital Inclusion (Non-Tech)',
  11: 'Public Services (Non-Tech)',
  12: 'Online Assessment (Non-Tech)'
};

const DOC_TITLES = {
  1: 'Team Details & Registration',
  2: 'Idea Presentation & Pitch Deck',
  3: 'Problem Statement Analysis',
  4: 'System Architecture & Workflow',
  5: 'Technology Stack & Feasibility',
  6: 'Implementation Roadmap & Milestones',
  7: 'Impact & Scalability Assessment',
  8: 'Working Prototype / Demo PoC'
};

function parseMarkdown(mdText) {
  const data = {
    college: '',
    challenge_raw: '',
    documents_summary: '',
    repo_raw: '',
    live_demo_raw: '',
    confidence_raw: '',
    summary: '',
    strengths: [],
    observations: [],
    live_demo_notes: '',
    repo_notes: '',
    qualification_checks: [],
    basis_scores: {},
    not_verified: [],
    files_reviewed: [],
    raw_markdown: mdText
  };

  if (!mdText) return data;

  // Header table regexes
  const mCollege = mdText.match(/\*\*College\*\*\s*\|\s*([^\|\n]+)/);
  if (mCollege) data.college = mCollege[1].trim();

  const mCh = mdText.match(/\*\*Challenge \/ Track\*\*\s*\|\s*([^\|\n]+)/);
  if (mCh) data.challenge_raw = mCh[1].trim();

  const mDocs = mdText.match(/\*\*Documents\*\*\s*\|\s*([^\|\n]+)/);
  if (mDocs) data.documents_summary = mDocs[1].trim();

  const mRepo = mdText.match(/\*\*Repository\*\*\s*\|\s*([^\|\n]+)/);
  if (mRepo) data.repo_raw = mRepo[1].trim();

  const mDemo = mdText.match(/\*\*Live demo\*\*\s*\|\s*([^\|\n]+)/);
  if (mDemo) data.live_demo_raw = mDemo[1].trim();

  const mConf = mdText.match(/\*\*Confidence\*\*\s*\|\s*([^\|\n]+)/);
  if (mConf) data.confidence_raw = mConf[1].trim();

  // Split into sections by '## '
  const sections = {};
  let currentSec = null;
  let secLines = [];

  mdText.split('\n').forEach(line => {
    if (line.startsWith('## ')) {
      if (currentSec) {
        sections[currentSec] = secLines.join('\n').trim();
      }
      currentSec = line.substring(3).trim();
      secLines = [];
    } else if (currentSec) {
      secLines.push(line);
    }
  });
  if (currentSec) {
    sections[currentSec] = secLines.join('\n').trim();
  }

  // Summary
  if (sections['Summary']) {
    data.summary = sections['Summary'];
  }

  // Strengths
  if (sections['Strengths']) {
    data.strengths = sections['Strengths'].split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('-'))
      .map(l => l.replace(/^-\s*/, ''));
  }

  // Observations
  if (sections['Observations']) {
    data.observations = sections['Observations'].split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('-'))
      .map(l => l.replace(/^-\s*/, ''));
  }

  // Live demo
  if (sections['Live demo']) {
    data.live_demo_notes = sections['Live demo'];
  }

  // Repository notes
  if (sections['Repository notes']) {
    data.repo_notes = sections['Repository notes'];
  }

  // Not verified
  if (sections['Not verified']) {
    data.not_verified = sections['Not verified'].split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('-'))
      .map(l => l.replace(/^-\s*/, ''));
  }

  // Qualification checks table
  if (sections['Qualification checks']) {
    sections['Qualification checks'].split('\n').forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4 && parts[1] && parts[1] !== 'Check' && !parts[1].startsWith('---')) {
        data.qualification_checks.push({ check: parts[1], result: parts[2], detail: parts[3] });
      }
    });
  }

  // Advisory scores basis
  Object.keys(sections).forEach(secName => {
    if (secName.includes('Advisory scores')) {
      sections[secName].split('\n').forEach(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 5 && parts[1] && parts[1] !== 'Code' && !parts[1].startsWith('---')) {
          data.basis_scores[parts[1]] = parts[4];
        }
      });
    }
  });

  // Files reviewed table
  if (sections['Files reviewed']) {
    sections['Files reviewed'].split('\n').forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4 && parts[1] && !parts[1].includes('Document') && !parts[1].startsWith('---')) {
        data.files_reviewed.push({ doc: parts[1], read_as: parts[2], ignored: parts[3] });
      }
    });
  }

  return data;
}

function parseChallengeDetails(chRaw) {
  let challengeNum = '';
  let displayTitle = '';
  let themeName = '';

  const m = chRaw.match(/(\d+)\s*[-—–]\s*(.*?)(?:\s*[-—–]\s*(Technical|Non-Technical))?$/);
  if (m) {
    challengeNum = m[1].padStart(2, '0');
    displayTitle = m[2].trim();
  } else {
    displayTitle = chRaw;
  }

  const cInt = parseInt(challengeNum, 10);
  if (!isNaN(cInt)) {
    const baseInt = cInt <= 6 ? cInt : cInt - 6;
    themeName = THEME_NAMES[cInt] || THEME_NAMES[baseInt] || displayTitle;
  } else {
    themeName = displayTitle;
  }

  return { challengeNum, displayTitle, themeName };
}

function extractGithubUrl(repoRaw) {
  if (!repoRaw) return { url: '', label: 'None' };
  const m = repoRaw.match(/(https?:\/\/github\.com\/[^\s/]+\/[^\s/]+)/);
  const url = m ? m[1] : '';
  const lower = repoRaw.toLowerCase();
  let label = 'Provided';
  if (lower.includes('empty repository') || lower.includes('0 commits')) {
    label = 'Empty Repo (0 Commits)';
  } else if (lower.includes('no repository')) {
    label = 'No Repo';
  } else if (lower.includes('reviewed')) {
    label = 'Static Code Reviewed';
  }
  return { url, label };
}

function composeRemark(data, verdict) {
  const head = [];
  if (verdict) head.push(`[${verdict}]`);
  if (data.missing_docs && data.missing_docs.length > 0) {
    head.push(`[Missing: ${data.missing_docs.join(', ')}]`);
  }
  const summary = (data.summary || '').trim().replace(/\n+/g, ' ');
  const strengths = (data.strengths || []).filter(x => x && x.trim());
  const obs = (data.observations || []).filter(x => x && x.trim());

  let parts = [head.join(' ')];
  if (summary) parts.push(`Summary: ${summary}`);
  if (strengths.length > 0) {
    parts.push(`Strengths: ` + strengths.map((s, i) => `(${i + 1}) ${s.replace(/[.;]+$/, '')};`).join(' '));
  }
  if (obs.length > 0) {
    parts.push(`Observations: ` + obs.map((o, i) => `(${i + 1}) ${o.replace(/[.;]+$/, '')};`).join(' '));
  }

  let text = parts.join(' ').trim();
  if (text.length > 3000) {
    text = text.substring(0, 2999) + '…';
  }
  return text;
}

function buildDashboardData() {
  if (!fs.existsSync(EVAL_DIR)) {
    throw new Error(`Evaluations directory not found at: ${EVAL_DIR}`);
  }

  const evalEntries = fs.readdirSync(EVAL_DIR, { withFileTypes: true });
  const scoreFilePaths = [];

  evalEntries.forEach(entry => {
    if (entry.isFile() && entry.name.match(/^T-\d+_scores\.json$/)) {
      scoreFilePaths.push({
        scorePath: path.join(EVAL_DIR, entry.name),
        dirPath: EVAL_DIR,
        fileName: entry.name
      });
    } else if (entry.isDirectory() && entry.name.match(/^T-\d+$/)) {
      const subDirPath = path.join(EVAL_DIR, entry.name);
      const subFiles = fs.readdirSync(subDirPath);
      const sf = subFiles.find(f => f.match(/^T-\d+_scores\.json$/));
      if (sf) {
        scoreFilePaths.push({
          scorePath: path.join(subDirPath, sf),
          dirPath: subDirPath,
          fileName: sf
        });
      }
    }
  });

  scoreFilePaths.sort((a, b) => {
    const numA = parseInt(a.fileName.match(/^T-(\d+)_/)[1], 10);
    const numB = parseInt(b.fileName.match(/^T-(\d+)_/)[1], 10);
    return numA - numB;
  });

  console.log(`Found ${scoreFilePaths.length} score files in evaluations/`);

  const teams = [];

  scoreFilePaths.forEach(item => {
    const sc = JSON.parse(fs.readFileSync(item.scorePath, 'utf8'));

    const tid = sc.team_id;
    const tidNum = tid.match(/T-(\d+)/)[1];
    const teamName = sc.team || '';

    // Find markdown file
    const dirFiles = fs.readdirSync(item.dirPath);
    const mdFileName = dirFiles.find(f => f.startsWith(`T-${tidNum}_`) && f.endsWith('_evaluation.md'));
    let mdData = { strengths: [], observations: [], basis_scores: {}, qualification_checks: [], files_reviewed: [] };
    if (mdFileName) {
      const mdContent = fs.readFileSync(path.join(item.dirPath, mdFileName), 'utf8');
      mdData = parseMarkdown(mdContent);
    }

    // Find pitch text in team folder or .work if present
    let pitchText = '';
    const teamPitchPath = path.join(item.dirPath, 'pitch.txt');
    const workPitchPath = path.join(WORK_DIR, `T-${tidNum}`, 'pitch.txt');
    if (fs.existsSync(teamPitchPath)) {
      pitchText = fs.readFileSync(teamPitchPath, 'utf8').trim();
    } else if (fs.existsSync(workPitchPath)) {
      pitchText = fs.readFileSync(workPitchPath, 'utf8').trim();
    }

    // Track detection
    const scores = sc.scores || {};
    const isTech = Object.keys(scores).some(k => k.startsWith('T'));
    const track = isTech ? 'Technical' : 'Non-Technical';

    // Challenge & Theme details
    const { challengeNum, displayTitle, themeName } = parseChallengeDetails(mdData.challenge_raw || '');

    // Score calculations
    let presScore = 0;
    let techScore = 0;
    let totalScore = 0;
    const criteriaList = [];

    if (track === 'Technical') {
      ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].forEach(k => {
        const meta = TECH_CRITERIA[k];
        const val = scores[k] || 0;
        const pts = (val / 5.0) * meta.weight;
        if (meta.group === 'pres') {
          presScore += pts;
        } else {
          techScore += pts;
        }
        criteriaList.push({
          code: k,
          name: meta.name,
          weight: meta.weight,
          group: meta.group,
          desc: meta.desc,
          score: val,
          max_score: 5,
          points: Math.round(pts * 100) / 100,
          basis: mdData.basis_scores[k] || ''
        });
      });
      totalScore = Math.round((presScore + techScore) * 10) / 10;
      presScore = Math.round(presScore * 10) / 10;
      techScore = Math.round(techScore * 10) / 10;
    } else {
      ['NT1', 'NT2', 'NT3', 'NT4', 'NT5', 'NT6', 'NT7', 'NT8'].forEach(k => {
        const meta = NON_TECH_CRITERIA[k];
        const val = scores[k] || 0;
        const pts = (val / 5.0) * meta.weight;
        presScore += pts;
        criteriaList.push({
          code: k,
          name: meta.name,
          weight: meta.weight,
          group: 'non_tech',
          desc: meta.desc,
          score: val,
          max_score: 5,
          points: Math.round(pts * 100) / 100,
          basis: mdData.basis_scores[k] || ''
        });
      });
      totalScore = Math.round(presScore * 10) / 10;
      presScore = Math.round(presScore * 10) / 10;
      techScore = null; // N/A
    }

    const { url: repoUrl, label: repoStatusLabel } = extractGithubUrl(mdData.repo_raw || '');
    const excelRemark = composeRemark({
      summary: sc.summary || mdData.summary,
      strengths: sc.strengths || mdData.strengths,
      observations: sc.observations || mdData.observations,
      missing_docs: sc.missing_docs || []
    }, sc.verdict || 'QUALIFIED');

    // Scan submission files on disk
    const submissionFiles = [];
    const subsDirPath = path.join(item.dirPath, 'submissions');
    if (fs.existsSync(subsDirPath)) {
      const docFiles = fs.readdirSync(subsDirPath).filter(f => !f.startsWith('.')).sort();
      docFiles.forEach(df => {
        const filePath = path.join(subsDirPath, df);
        const stats = fs.statSync(filePath);
        const m = df.match(/_doc(\d)_/i);
        const docN = m ? parseInt(m[1], 10) : null;
        const docTitle = DOC_TITLES[docN] || (docN ? `Document ${docN}` : 'Submission Document');
        submissionFiles.push({
          filename: df,
          path: `evaluations/T-${tidNum}/submissions/${df}`,
          doc_num: docN,
          doc_title: docTitle,
          size_kb: Math.round((stats.size / 1024) * 10) / 10
        });
      });
    }

    // Enrich files_reviewed
    const filesReviewed = (mdData.files_reviewed || []).map(fr => {
      const rawDoc = fr.doc || '';
      const cleanDoc = rawDoc.replace(/^Doc\d+\s*/i, '').trim();
      let matchedPath = '';
      let matchedTitle = '';
      let matchedSize = 0;

      for (const sf of submissionFiles) {
        if (sf.filename === rawDoc || sf.filename === cleanDoc) {
          matchedPath = sf.path;
          matchedTitle = sf.doc_title;
          matchedSize = sf.size_kb;
          break;
        }
      }

      if (!matchedPath) {
        const mDoc = rawDoc.match(/_doc(\d)_/i) || rawDoc.match(/Doc(\d)/i);
        if (mDoc) {
          const targetN = parseInt(mDoc[1], 10);
          for (let i = submissionFiles.length - 1; i >= 0; i--) {
            if (submissionFiles[i].doc_num === targetN) {
              matchedPath = submissionFiles[i].path;
              matchedTitle = submissionFiles[i].doc_title;
              matchedSize = submissionFiles[i].size_kb;
              break;
            }
          }
        }
      }

      return {
        doc: rawDoc,
        clean_doc: cleanDoc,
        read_as: fr.read_as || 'OK',
        ignored: fr.ignored || 'none',
        path: matchedPath || `evaluations/T-${tidNum}/submissions/${cleanDoc}`,
        doc_title: matchedTitle || 'Submission Document',
        size_kb: matchedSize
      };
    });

    teams.push({
      team_id: tid,
      team_number: parseInt(tidNum, 10),
      team_name: teamName,
      college: mdData.college || 'Institution',
      track: track,
      challenge_no: challengeNum,
      challenge_title: displayTitle,
      theme_name: themeName,
      verdict: sc.verdict || 'QUALIFIED',
      verdict_reason: sc.verdict_reason || '',
      confidence: sc.confidence || 'Medium',
      excel_status: sc.excel_status || 'Written',
      demo_status: sc.demo_status || mdData.live_demo_raw || 'Not provided',
      demo_url: sc.demo_url || '',
      demo_screenshots: sc.demo_screenshots || [],
      tech_stack: sc.tech_stack || {},
      cloned_repo: sc.cloned_repo || false,
      missing_docs: sc.missing_docs || [],
      has_missing_docs: (sc.missing_docs || []).length > 0,
      doc_count_text: mdData.documents_summary || ((sc.missing_docs || []).length > 0 ? `${8 - sc.missing_docs.length}/8 submitted` : '8/8 submitted'),
      repo_url: repoUrl,
      repo_status_label: repoStatusLabel,
      repo_raw: mdData.repo_raw || '',
      repo_notes: mdData.repo_notes || '',
      summary: sc.summary || mdData.summary || '',
      strengths: sc.strengths || mdData.strengths || [],
      observations: sc.observations || mdData.observations || [],
      admin_notes: sc.admin_notes || [],
      not_verified: mdData.not_verified || [],
      qualification_checks: mdData.qualification_checks || [],
      files_reviewed: filesReviewed,
      submission_files: submissionFiles,
      scores: scores,
      pres_score: presScore,
      tech_score: techScore,
      total_score: totalScore,
      criteria: criteriaList,
      pitch: pitchText,
      excel_remark: excelRemark,
      raw_markdown: mdData.raw_markdown || '',
      originality_score: sc.originality_score || 85,
      ai_generated_percentage: sc.ai_generated_percentage || 10,
      plagiarism_percentage: sc.plagiarism_percentage || 2,
      probable_ai_tools: sc.probable_ai_tools || [],
      originality_analysis: sc.originality_analysis || {},
      challenge_details: sc.challenge_details || null
    });
  });

  // Calculate ranks
  const techTeams = teams.filter(t => t.track === 'Technical').sort((a, b) => b.total_score - a.total_score);
  techTeams.forEach((t, i) => { t.rank_track = i + 1; });

  const nonTechTeams = teams.filter(t => t.track === 'Non-Technical').sort((a, b) => b.total_score - a.total_score);
  nonTechTeams.forEach((t, i) => { t.rank_track = i + 1; });

  teams.sort((a, b) => b.total_score - a.total_score);
  teams.forEach((t, i) => { t.rank_overall = i + 1; });

  // Aggregates
  const totalEvaluated = teams.length;
  const totalQualified = teams.filter(t => t.verdict === 'QUALIFIED').length;
  const totalConditional = teams.filter(t => t.verdict.includes('CONDITIONS')).length;
  const totalDisqualified = teams.filter(t => t.verdict === 'DISQUALIFIED').length;
  const missingDocsCount = teams.filter(t => t.has_missing_docs).length;
  const emptyReposCount = teams.filter(t => t.repo_status_label.includes('Empty')).length;
  const highConfidenceCount = teams.filter(t => t.confidence === 'High').length;
  const avgTotalScore = totalEvaluated > 0 ? Math.round((teams.reduce((acc, t) => acc + t.total_score, 0) / totalEvaluated) * 10) / 10 : 0;
  const topScore = teams.length > 0 ? Math.max(...teams.map(t => t.total_score)) : 0;

  // Criteria averages for tech
  const techCritAverages = {};
  if (techTeams.length > 0) {
    Object.keys(TECH_CRITERIA).forEach(k => {
      const vals = techTeams.filter(t => t.scores[k] !== undefined).map(t => t.scores[k]);
      techCritAverages[k] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
    });
  }

  // Theme counts
  const themeCounts = {};
  teams.forEach(t => {
    const th = t.theme_name || 'Other';
    themeCounts[th] = (themeCounts[th] || 0) + 1;
  });

  // Originality aggregates
  const avgOriginality = totalEvaluated > 0 ? Math.round((teams.reduce((acc, t) => acc + (t.originality_score || 85), 0) / totalEvaluated) * 10) / 10 : 0;
  const avgAiPct = totalEvaluated > 0 ? Math.round((teams.reduce((acc, t) => acc + (t.ai_generated_percentage || 10), 0) / totalEvaluated) * 10) / 10 : 0;
  const highOrigCount = teams.filter(t => (t.originality_score || 85) >= 80).length;
  const modOrigCount = teams.filter(t => (t.originality_score || 85) >= 50 && (t.originality_score || 85) < 80).length;
  const lowOrigCount = teams.filter(t => (t.originality_score || 85) < 50).length;
  const aiToolsCount = teams.filter(t => (t.probable_ai_tools || []).some(x => !x.includes('None detected'))).length;
  const crossPlagCount = teams.filter(t => ((t.originality_analysis || {}).cross_team_plagiarism_matches || []).length > 0).length;

  const toolCounts = {};
  teams.forEach(t => {
    (t.probable_ai_tools || []).forEach(tool => {
      if (!tool.includes('None detected')) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
    });
  });

  return {
    metadata: {
      event_name: 'MPOnline Idea & Innovation Hackathon 2026',
      lead_evaluator: 'Mr. Deven Goratela',
      role: 'Lead / Technical Evaluator',
      last_updated: new Date().toISOString(),
      total_teams_hackathon: 270,
      total_evaluated: totalEvaluated,
      progress_percent: Math.round((totalEvaluated / 270) * 1000) / 10,
      total_qualified: totalQualified,
      total_conditional: totalConditional,
      total_disqualified: totalDisqualified,
      missing_docs_count: missingDocsCount,
      empty_repos_count: emptyReposCount,
      high_confidence_count: highConfidenceCount,
      avg_total_score: avgTotalScore,
      top_score: topScore,
      tech_count: techTeams.length,
      non_tech_count: nonTechTeams.length,
      tech_crit_averages: techCritAverages,
      theme_counts: themeCounts,
      avg_originality: avgOriginality,
      avg_ai_pct: avgAiPct,
      high_orig_count: highOrigCount,
      mod_orig_count: modOrigCount,
      low_orig_count: lowOrigCount,
      ai_tools_count: aiToolsCount,
      cross_plag_count: crossPlagCount,
      tool_counts: toolCounts
    },
    rubrics: {
      technical: TECH_CRITERIA,
      non_technical: NON_TECH_CRITERIA
    },
    teams: teams
  };
}

// Read current template or generate HTML
function getDashboardHtml(dataJsonStr) {
  // Read evaluations_dashboard.html template and inject new data
  const templatePath = path.join(ROOT_DIR, 'evaluations_dashboard.html');
  if (fs.existsSync(templatePath)) {
    const currentHtml = fs.readFileSync(templatePath, 'utf8');
    const safeJsonStr = dataJsonStr.replace(/<\/script>/g, '<\\/script>');
    return currentHtml.replace(
      /window\.EVALUATIONS_DATA\s*=\s*\{[\s\S]*?\};\s*<\/script>/,
      `window.EVALUATIONS_DATA = ${safeJsonStr};\n  </script>`
    );
  }
  throw new Error("Template evaluations_dashboard.html not found");
}

function main() {
  console.log("==================================================");
  console.log("MPOnline Hackathon 2026 — Node.js Dashboard Builder");
  console.log("==================================================");

  const data = buildDashboardData();
  console.log(`Compiled data for ${data.teams.length} evaluated teams.`);

  const dataJsonStr = JSON.stringify(data, null, 2);

  // Write evaluations_data.json
  const jsonPath = path.join(ROOT_DIR, 'evaluations_data.json');
  fs.writeFileSync(jsonPath, dataJsonStr, 'utf8');
  console.log(`Wrote ${jsonPath}`);

  // Write evaluations_data.js
  const jsPath = path.join(ROOT_DIR, 'evaluations_data.js');
  fs.writeFileSync(jsPath, `window.EVALUATIONS_DATA = ${dataJsonStr};\n`, 'utf8');
  console.log(`Wrote ${jsPath}`);

  // Update evaluations_dashboard.html
  const updatedHtml = getDashboardHtml(dataJsonStr);
  const htmlPath = path.join(ROOT_DIR, 'evaluations_dashboard.html');
  fs.writeFileSync(htmlPath, updatedHtml, 'utf8');
  console.log(`Wrote ${htmlPath}`);

  // Update index.html
  const indexPath = path.join(ROOT_DIR, 'index.html');
  fs.writeFileSync(indexPath, updatedHtml, 'utf8');
  console.log(`Wrote ${indexPath}`);

  console.log("\nSUCCESS! Dashboard rebuilt via JavaScript (Node.js).");
  console.log(`Open in browser: file://${htmlPath}`);
}

main();
