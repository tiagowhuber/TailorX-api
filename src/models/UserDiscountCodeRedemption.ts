import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserDiscountCodeRedemptionAttributes {
  id: number;
  discount_code_id: number;
  user_id: number;
  order_id?: number;
  redeemed_at?: Date;
}

interface UserDiscountCodeRedemptionCreationAttributes extends Optional<UserDiscountCodeRedemptionAttributes, 'id' | 'order_id' | 'redeemed_at'> {}

class UserDiscountCodeRedemption extends Model<UserDiscountCodeRedemptionAttributes, UserDiscountCodeRedemptionCreationAttributes> implements UserDiscountCodeRedemptionAttributes {
  public id!: number;
  public discount_code_id!: number;
  public user_id!: number;
  public order_id?: number;
  public redeemed_at?: Date;
}

UserDiscountCodeRedemption.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    discount_code_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'discount_codes',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id',
      },
    },
    redeemed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'user_discount_code_redemptions',
    timestamps: false,
  }
);

export default UserDiscountCodeRedemption;
