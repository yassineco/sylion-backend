/**
 * ================================
 * Phone Normalizer Unit Tests - Sylion Backend
 * ================================
 * 
 * Tests unitaires pour la fonction de normalisation 
 * des numéros de téléphone WhatsApp.
 * 
 * Objectif : Empêcher la régression du bug du double préfixe "+".
 */

import { normalizePhoneNumber } from '@/modules/whatsapp/types';
// Vitest globals are enabled via vitest config

describe('normalizePhoneNumber', () => {
  
  describe('Valid phone number cases', () => {
    
    it('should add + prefix to raw number without plus', () => {
      const input = '1234567890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should keep already normalized number unchanged', () => {
      const input = '+1234567890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should handle international numbers correctly', () => {
      const input = '33123456789';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+33123456789');
    });

    it('should handle already formatted international numbers', () => {
      const input = '+33123456789';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+33123456789');
    });
  });

  describe('Bug regression tests', () => {
    
    it('should NOT create double plus prefix (main regression test)', () => {
      const input = '++1234567890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should handle multiple plus signs correctly', () => {
      const input = '+++1234567890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });
  });

  describe('Formatted input cases', () => {
    
    it('should remove spaces and formatting from number without plus', () => {
      const input = '  123 456 7890  ';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should remove spaces and formatting from number with plus', () => {
      const input = '+1 234 567 890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should handle dashes and parentheses formatting', () => {
      const input = '(123) 456-7890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should handle mixed formatting with existing plus', () => {
      const input = '+1 (234) 567-890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });
  });

  describe('Edge cases and invalid inputs', () => {
    
    it('should handle empty string', () => {
      const input = '';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('');
    });

    // A standalone '+' without digits is considered invalid → returns original input
    it('should handle string with only plus sign', () => {
      const input = '+';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('');
    });

    it('should handle string with only spaces', () => {
      const input = '   ';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('');
    });

    it('should handle string with only formatting characters', () => {
      const input = '()-  ';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('');
    });

    it('should handle letters mixed with numbers (remove letters)', () => {
      const input = 'abc123def456ghi';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+123456');
    });

    it('should handle plus sign in middle of number', () => {
      const input = '123+456789';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+123456789');
    });
  });

  describe('WhatsApp specific scenarios', () => {
    
    it('should handle webhook phone format from WhatsApp API', () => {
      // Format souvent utilisé par WhatsApp Business API
      const input = '1234567890';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+1234567890');
    });

    it('should handle user-entered phone with country code', () => {
      const input = '+33 6 12 34 56 78';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+33612345678');
    });

    it('should handle phone number from contact import', () => {
      const input = '  +1-555-123-4567  ';
      const result = normalizePhoneNumber(input);
      expect(result).toBe('+15551234567');
    });
  });
});