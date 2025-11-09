import React from 'react';
import { Box, Typography, Divider, Tooltip } from '@mui/material';
import { formatPrice, formatNumber } from '../lib/utils';

interface CostBreakdownData {
  cnyPrice: number;
  exchangeRate: number;
  gapPerUnit: number;
  logisticsFeePerUnit: number;
  totalLogisticsFee?: number;
  totalQuantity?: number;
}

interface CostBreakdownTooltipProps {
  data: CostBreakdownData;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  title?: string;
}

export const CostBreakdownTooltip: React.FC<CostBreakdownTooltipProps> = ({
  data,
  children,
  placement = 'left',
  title = 'Final Unit Cost Breakdown'
}) => {
  const { cnyPrice, exchangeRate, gapPerUnit, logisticsFeePerUnit, totalLogisticsFee, totalQuantity } = data;
  
  // Calculate components
  const basePrice = cnyPrice * exchangeRate;
  const finalUnitCost = basePrice + gapPerUnit + logisticsFeePerUnit;

  return (
    <Tooltip
      title={
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#fff' }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.75, sm: 0.5 } }}>
            {/* Base Price */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 0.25, sm: 0 }
            }}>
              <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 'inherit' }}>
                Base Price (¥{formatNumber(cnyPrice)} × {formatNumber(exchangeRate)}):
              </Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                color: '#fff', 
                ml: { xs: 0, sm: 2 },
                fontSize: 'inherit'
              }}>
                {formatPrice(basePrice)}
              </Typography>
            </Box>

            {/* Gap Calculation Split */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 0.25, sm: 0 }
            }}>
              <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 'inherit' }}>
                Gap Calculation Split:
              </Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                color: gapPerUnit >= 0 ? '#4caf50' : '#f44336', 
                ml: { xs: 0, sm: 2 },
                fontSize: 'inherit'
              }}>
                {gapPerUnit >= 0 ? '+' : ''}{formatPrice(gapPerUnit)}
              </Typography>
            </Box>

            {/* Logistics Fee */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 0.25, sm: 0 }
            }}>
              <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 'inherit' }}>
                Logistics Fee{totalLogisticsFee && totalQuantity ? ` (${formatPrice(Math.round(totalLogisticsFee))} ÷ ${formatNumber(totalQuantity)})` : ''}:
              </Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                color: '#fff', 
                ml: { xs: 0, sm: 2 },
                fontSize: 'inherit'
              }}>
                +{formatPrice(logisticsFeePerUnit)}
              </Typography>
            </Box>

            <Divider sx={{ my: 1, bgcolor: '#555' }} />

            {/* Total Final Unit Cost */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 0.25, sm: 0 }
            }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff', fontSize: 'inherit' }}>
                Total Final Unit Cost:
              </Typography>
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                color: '#4caf50', 
                ml: { xs: 0, sm: 2 },
                fontSize: 'inherit'
              }}>
                {formatPrice(finalUnitCost)}
              </Typography>
            </Box>
          </Box>
        </Box>
      }
      arrow
      placement={placement}
      enterDelay={0}
      leaveDelay={200}
      sx={{
        '& .MuiTooltip-tooltip': {
          bgcolor: 'rgba(33, 33, 33, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          maxWidth: { xs: 280, sm: 350, md: 400 },
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          lineHeight: 1.4,
          padding: { xs: '8px 12px', sm: '12px 16px' },
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
        '& .MuiTooltip-arrow': {
          color: 'rgba(33, 33, 33, 0.95)',
          '&::before': {
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
};

export default CostBreakdownTooltip;