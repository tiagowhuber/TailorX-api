import { Request, Response } from 'express';
import JSZip from 'jszip';
import { User, Design, UserMeasurement, MeasurementType, DesignMeasurement } from '../models';
import {
  transformMeasurementsForFreeSewing,
  validateRequiredMeasurements,
  generateFreeSewingPattern,
  extractRequiredMeasurementKeys,
  cleanMirroredSvg,
} from '../utils/freesewing';
import { TailorFitService, PatternLayoutStats } from '../services/TailorFitService';
import { generateLayoutReport } from '../utils/layoutReportGenerator';
import { generateLerComparisonReport } from '../utils/lerComparisonGenerator';

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export const batchGenerate = async (req: Request, res: Response) => {
  try {
    const { personIds, designIds } = req.body;

    if (
      !Array.isArray(personIds) || personIds.length === 0 ||
      !Array.isArray(designIds) || designIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'personIds and designIds must be non-empty arrays',
      });
    }

    // Validate all IDs are numbers
    const allIds = [...personIds, ...designIds];
    if (allIds.some((id) => typeof id !== 'number' || !Number.isInteger(id))) {
      return res.status(400).json({
        success: false,
        message: 'All IDs in personIds and designIds must be integers',
      });
    }

    // Fetch all users upfront
    const users = await User.findAll({ where: { id: personIds } });
    const foundUserIds = new Set(users.map((u) => u.id));
    const missingUsers = personIds.filter((id: number) => !foundUserIds.has(id));
    if (missingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Users not found: ${missingUsers.join(', ')}`,
      });
    }

    // Fetch all designs upfront
    const designs = await Design.findAll({ where: { id: designIds } });
    const foundDesignIds = new Set(designs.map((d) => d.id));
    const missingDesigns = designIds.filter((id: number) => !foundDesignIds.has(id));
    if (missingDesigns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Designs not found: ${missingDesigns.join(', ')}`,
      });
    }

    const inactiveDesigns = designs.filter((d) => !d.is_active || !d.freesewing_pattern);
    if (inactiveDesigns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Inactive or unsupported designs: ${inactiveDesigns.map((d) => d.id).join(', ')}`,
      });
    }

    // Fetch required measurements per design
    const designMeasurementsMap = new Map<number, DesignMeasurement[]>();
    for (const design of designs) {
      const designMeasurements = await DesignMeasurement.findAll({
        where: { design_id: design.id },
        include: [
          {
            model: MeasurementType,
            as: 'measurementType',
            attributes: ['id', 'name', 'freesewing_key'],
          },
        ],
      });
      designMeasurementsMap.set(design.id, designMeasurements);
    }

    const zip = new JSZip();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const rootFolder = `batch_${timestamp}`;

    const results: Array<{
      userId: number;
      designId: number;
      status: 'success' | 'failed';
      filename?: string;
      reason?: string;
    }> = [];

    const layoutAnalysisEntries: PatternLayoutStats[] = [];

    for (const design of designs) {
      const designMeasurements = designMeasurementsMap.get(design.id)!;
      const requiredKeys = extractRequiredMeasurementKeys(designMeasurements);

      for (const user of users) {
        const userMeasurements = await UserMeasurement.findAll({
          where: { user_id: user.id },
          include: [
            {
              model: MeasurementType,
              as: 'measurementType',
              attributes: ['id', 'name', 'freesewing_key'],
            },
          ],
        });

        const freesewingMeasurements = transformMeasurementsForFreeSewing(userMeasurements);
        const validation = validateRequiredMeasurements(freesewingMeasurements, requiredKeys);

        if (!validation.isValid) {
          results.push({
            userId: user.id,
            designId: design.id,
            status: 'failed',
            reason: `Missing measurements: ${validation.missing.join(', ')}`,
          });
          continue;
        }

        const settings = {
          ...(design.default_settings || { sa: 10, complete: true }),
          paperless: true,
        };

        let svg: string;
        try {
          const generated = await generateFreeSewingPattern({
            patternType: `${design.freesewing_pattern} mirrored`,
            measurements: freesewingMeasurements,
            settings,
          });
          svg = cleanMirroredSvg(generated.svg, design.freesewing_pattern!);
        } catch (err: any) {
          results.push({
            userId: user.id,
            designId: design.id,
            status: 'failed',
            reason: err.message,
          });
          continue;
        }

        const personSlug = toSlug(`${user.first_name}_${user.last_name}_${user.id}`);
        const designSlug = toSlug(`${design.name}_${design.id}`);

        let pltResult: { content: string | Buffer; mimeType: string; filename: string; stats: PatternLayoutStats | null };
        try {
          const service = new TailorFitService();
          pltResult = await service.process(svg, design.freesewing_pattern!, {
            userId:     user.id,
            userName:   `${user.first_name} ${user.last_name}`,
            designId:   design.id,
            designName: design.name,
            patternKey: `${personSlug}__${designSlug}`
          });
          if (pltResult.stats) {
            layoutAnalysisEntries.push(pltResult.stats);
          }
        } catch (err: any) {
          results.push({
            userId: user.id,
            designId: design.id,
            status: 'failed',
            reason: `PLT export failed: ${err.message}`,
          });
          continue;
        }
        const ext = pltResult.mimeType === 'application/zip' ? 'zip' : 'plt';
        const filename = `${rootFolder}/${personSlug}/${designSlug}.${ext}`;

        zip.file(filename, pltResult.content);

        results.push({
          userId: user.id,
          designId: design.id,
          status: 'success',
          filename,
        });
      }
    }

    const totalSuccess = results.filter((r) => r.status === 'success').length;
    const totalFailed = results.filter((r) => r.status === 'failed').length;

    if (totalSuccess === 0) {
      return res.status(422).json({
        success: false,
        message: 'No patterns could be generated. See results for details.',
        results,
      });
    }

    const summary = {
      generated_at: new Date().toISOString(),
      total_requested: personIds.length * designIds.length,
      total_success: totalSuccess,
      total_failed: totalFailed,
      results,
    };

    zip.file(`${rootFolder}/summary.json`, JSON.stringify(summary, null, 2));

    const layoutAnalysis = {
      generated_at: new Date().toISOString(),
      total_patterns: layoutAnalysisEntries.length,
      bed_dimensions: { widthMm: 2500, heightMm: 1300 },
      patterns: layoutAnalysisEntries,
    };
    zip.file(`${rootFolder}/layout_analysis.json`, JSON.stringify(layoutAnalysis, null, 2));
    zip.file(`${rootFolder}/layout_report.html`, generateLayoutReport(layoutAnalysis));
    zip.file(`${rootFolder}/ler_comparison.html`, generateLerComparisonReport(layoutAnalysis));

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${rootFolder}.zip"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  } catch (error: any) {
    console.error('Batch generate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during batch generation',
    });
  }
};
