import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface DiscountCodeAttributes {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  value: number;
  max_discount_amount?: number;
  starts_at?: Date;
  expires_at?: Date;
  max_total_uses?: number;
  current_total_uses: number;
  max_unique_users?: number;
  max_uses_per_user?: number;
  applies_to_design_id?: number;
  target_design_ids?: number[];
  is_free_shipping: boolean;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface DiscountCodeCreationAttributes extends Optional<DiscountCodeAttributes, 'id' | 'current_total_uses' | 'is_free_shipping' | 'is_active' | 'created_at' | 'updated_at'> {}

class DiscountCode extends Model<DiscountCodeAttributes, DiscountCodeCreationAttributes> implements DiscountCodeAttributes {
  public id!: number;
  public code!: string;
  public discount_type!: 'percentage' | 'fixed_amount';
  public value!: number;
  public max_discount_amount?: number;
  public starts_at?: Date;
  public expires_at?: Date;
  public max_total_uses?: number;
  public current_total_uses!: number;
  public max_unique_users?: number;
  public max_uses_per_user?: number;
  public applies_to_design_id?: number;
  public target_design_ids?: number[];
  public is_free_shipping!: boolean;
  public is_active!: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

DiscountCode.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    discount_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['percentage', 'fixed_amount']],
      },
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    max_discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    max_total_uses: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    current_total_uses: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    max_unique_users: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    max_uses_per_user: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    applies_to_design_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
          model: 'designs',
          key: 'id'
      }
    },
    target_design_ids: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: true,
    },
    is_free_shipping: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'discount_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default DiscountCode;
