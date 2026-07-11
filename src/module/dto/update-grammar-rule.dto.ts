import { PartialType } from '@nestjs/swagger';
import { CreateGrammarRuleDto } from './create-grammar-rule.dto';

export class UpdateGrammarRuleDto extends PartialType(CreateGrammarRuleDto) { }
