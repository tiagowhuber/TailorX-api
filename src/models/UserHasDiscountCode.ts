import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface UserHasDiscountCodeAttributes {
  user_id: number;
  discount_code_id: number;
  assigned_at?: Date;
}

class UserHasDiscountCode extends Model<UserHasDiscountCodeAttributes> implements UserHasDiscountCodeAttributes {
  public user_id!: number;
  public discount_code_id!: number;
  public assigned_at?: Date;
}

UserHasDiscountCode.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    discount_code_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'discount_codes',
        key: 'id',
      },
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'user_has_discount_codes',
    timestamps: false,
  }
);

export default UserHasDiscountCode;
